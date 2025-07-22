import NextAuth, { AuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import PostgresAdapter from "@auth/pg-adapter"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"
import { authLogger } from "@/lib/auth-logger"

export const authOptions: AuthOptions = {
  adapter: PostgresAdapter(db),
  session: {
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // Refresh daily
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "select_account",
          access_type: "offline",
          response_type: "code",
          scope:
            "openid email profile https://www.googleapis.com/auth/drive.file",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === "google") {
        // Log only critical refresh token issues
        if (!account.refresh_token) {
          authLogger.warn("No refresh token in OAuth response", {
            isSubsequentLogin: true,
            hasAccessToken: !!account.access_token,
            timestamp: Date.now()
          }, 'TOKEN_ERROR');
        }

        // SECURE MANUAL TOKEN UPDATE - Fixed to prevent user account conflation
        // We need this manual update because NextAuth PostgreSQL adapter doesn't reliably 
        // update tokens on every login (as documented in PROJECT.md), but we must ensure
        // we only update tokens for the correct user to prevent security issues.
        try {

          // SECURE TOKEN UPDATE: Update tokens using providerAccountId + provider
          // This is secure because providerAccountId is Google's unique, immutable identifier
          const result = await db.query(
            `
            UPDATE accounts
            SET
              access_token = $1,
              expires_at = $2,
              refresh_token = COALESCE($3, refresh_token)
            WHERE "providerAccountId" = $4 
              AND provider = $5
            RETURNING "userId", access_token, refresh_token, expires_at;
            `,
            [
              account.access_token,
              account.expires_at,
              account.refresh_token,
              account.providerAccountId,
              account.provider
            ]
          );

          if (result.rows.length === 0) {
            authLogger.warn("Secure token update found no matching user-account combination", {
              providerAccountId: account.providerAccountId,
              provider: account.provider,
              profileEmail: profile?.email,
              timestamp: Date.now()
            }, 'AUTH_ERROR');
          }
        } catch (error) {
          authLogger.error("Secure database token update failed", error, 'AUTH_ERROR');
        }

        const requiredScopes = [
          "https://www.googleapis.com/auth/drive.file"
        ]
        
        // Get the granted scopes from the account
        const grantedScopes = account.scope?.split(" ") || []
        
        // Check if all required scopes are granted
        const hasAllRequiredScopes = requiredScopes.every(scope => 
          grantedScopes.includes(scope)
        )
        
        if (!hasAllRequiredScopes) {
          const missingScopes = requiredScopes.filter(scope => !grantedScopes.includes(scope));
          authLogger.error("OAuth scope validation failed - missing required scopes", {
            requiredScopes,
            grantedScopes,
            missingScopes,
            providerAccountId: account.providerAccountId,
            timestamp: Date.now()
          }, 'AUTH_ERROR');
          
          // Prevent sign-in by returning false
          // This will redirect to the error page with error=AccessDenied
          return false
        }
      }
      
      return true
    },

    async redirect({ url, baseUrl }) {
      // Handle sign-out redirects efficiently
      if (url.includes('/auth/signin')) {
        return `${baseUrl}/auth/signin`;
      }

      // If the URL is a callback URL, redirect to dashboard
      if (url.includes('/api/auth/callback')) {
        return `${baseUrl}/dashboard`
      }
      
      // Allows relative callback URLs
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`;
      }
      
      // Allows callback URLs on the same origin
      if (new URL(url).origin === baseUrl) {
        return url;
      }
      
      // Default redirect to dashboard for successful sign-ins
      return `${baseUrl}/dashboard`
    },
    
    async session({ session, user, token }) {
      const hasUser = !!user;
      const hasToken = !!token;
      const sessionExists = !!session;
      
      // Detect potential logout scenario - improved detection
      const isLogoutScenario = (!hasUser || !hasToken) && sessionExists;

      // SECURITY: Validate user-account consistency to prevent account conflation
      if (user?.id && session?.user?.email) {
        try {
          // Verify that the user's email matches their database record
          const accountVerification = await db.query(
            `SELECT u.email as user_email, a."providerAccountId"
             FROM users u 
             JOIN accounts a ON u.id = a."userId"
             WHERE u.id = $1 AND a.provider = 'google'
             LIMIT 1`,
            [user.id]
          );

          if (accountVerification.rows.length > 0) {
            const row = accountVerification.rows[0];
            const emailMismatch = row.user_email !== user.email;
            
            if (emailMismatch) {
              authLogger.error("CRITICAL SECURITY ISSUE: User email mismatch detected", {
                sessionUserId: user.id,
                sessionUserEmail: user.email,
                databaseUserEmail: row.user_email,
                providerAccountId: row.providerAccountId,
                timestamp: Date.now()
              }, 'SECURITY_VIOLATION');
              
              // Log this critical security issue but don't break the session
              authLogger.error("Account conflation detected - this should not happen with secure token updates", {
                userId: user.id,
                timestamp: Date.now()
              }, 'SECURITY_VIOLATION');
            }
          }
        } catch (error) {
          authLogger.error("Session security validation failed", error, 'AUTH_ERROR');
          // Don't block the session for database errors, but log them
        }
      }

      if (session.user) {
        session.user.id = user.id
      }

      try {
        // Fetching tokens from database for session

        const { rows } = await db.query(
          `
          SELECT access_token, refresh_token, expires_at
          FROM accounts
          WHERE "userId" = $1 AND provider = 'google'
          ORDER BY "updatedAt" DESC LIMIT 1
        `,
          [user.id]
        )

        if (rows && rows.length > 0) {
          session.accessToken = rows[0].access_token
          session.refreshToken = rows[0].refresh_token
        } else {
          authLogger.warn("No tokens found in database for user session", {
            userId: user.id,
            timestamp: Date.now()
          }, 'TOKEN_ERROR');
        }
      } catch (error) {
        authLogger.error("Error fetching tokens from database for session", error, 'AUTH_ERROR');
      }

      return session
    },
  },
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST } 