import NextAuth, { AuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import PostgresAdapter from "@auth/pg-adapter"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"
import { authLogger } from "@/lib/auth-logger"

export const authOptions: AuthOptions = {
  adapter: PostgresAdapter(db),
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
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
          scope:
            "openid email profile https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      authLogger.info('NextAuth signIn callback initiated', {
        provider: account?.provider,
        profileExists: !!profile,
        timestamp: Date.now()
      }, 'SIGNIN_CALLBACK');

      if (account?.provider === "google") {
        // Extensive OAuth logging
        authLogger.info('Google OAuth signIn callback processing', {
          provider: account.provider,
          providerAccountId: account.providerAccountId,
          access_token_exists: !!account.access_token,
          access_token_length: account.access_token?.length,
          refresh_token_exists: !!account.refresh_token,
          refresh_token_length: account.refresh_token?.length,
          scope: account.scope,
          expires_at: account.expires_at,
          token_type: account.token_type,
          expires_in: account.expires_in,
          profile_email: profile?.email,
          profile_verified: (profile as any)?.email_verified
        }, 'GOOGLE_SIGNIN');

        // Log scope details
        const receivedScopes = account.scope?.split(" ") || [];
        authLogger.info('OAuth scopes received from Google', {
          grantedScopes: receivedScopes,
          scopeCount: receivedScopes.length,
          rawScope: account.scope
        }, 'OAUTH_SCOPES');

        // Overhaul logging for deep debugging
        logger.info('NextAuth signIn callback triggered for Google provider.');
        logger.debug('Received account object from Google:', {
          provider: account.provider,
          providerAccountId: account.providerAccountId,
          access_token_exists: !!account.access_token,
          refresh_token_exists: !!account.refresh_token,
          scope: account.scope,
          expires_at: account.expires_at,
          token_type: account.token_type,
        });

        if (account.refresh_token) {
          authLogger.info("New refresh token received from Google", {
            isFirstConsent: true,
            refreshTokenLength: account.refresh_token.length,
            timestamp: Date.now()
          }, 'REFRESH_TOKEN');
          logger.info("A new refresh_token was provided by Google. This should happen on the first consent.");
        } else {
          authLogger.warn("No refresh token in OAuth response", {
            isSubsequentLogin: true,
            hasAccessToken: !!account.access_token,
            timestamp: Date.now()
          }, 'REFRESH_TOKEN');
          logger.warn("No refresh_token was provided. This is expected on subsequent logins. If you just revoked and re-granted access, this might indicate a configuration issue.");
        }

        // Manually update tokens in the database to ensure they are always fresh.
        try {
          authLogger.info('Starting database token update', {
            providerAccountId: account.providerAccountId,
            hasAccessToken: !!account.access_token,
            hasRefreshToken: !!account.refresh_token,
            expiresAt: account.expires_at,
            timestamp: Date.now()
          }, 'DB_TOKEN_UPDATE');

          logger.debug('Attempting to manually update tokens in the database...', { providerAccountId: account.providerAccountId });
          const result = await db.query(
            `
            UPDATE accounts
            SET
              access_token = $1,
              expires_at = $2,
              refresh_token = COALESCE($3, refresh_token) -- Only update refresh_token if a new one is provided
            WHERE "providerAccountId" = $4
            RETURNING "userId", access_token, refresh_token, expires_at; -- Return the updated row for verification
            `,
            [
              account.access_token,
              account.expires_at,
              account.refresh_token,
              account.providerAccountId,
            ]
          );

          if (result.rows.length > 0) {
            authLogger.info("Database token update successful", {
              userId: result.rows[0].userId,
              providerAccountId: account.providerAccountId,
              rowsUpdated: result.rowCount,
              hasStoredRefreshToken: !!result.rows[0].refresh_token,
              timestamp: Date.now()
            }, 'DB_TOKEN_UPDATE');
            logger.info("Successfully updated tokens in the database.", { updatedRow: result.rows[0] });
          } else {
            authLogger.warn("Database token update found no matching account", {
              providerAccountId: account.providerAccountId,
              queryResult: result,
              timestamp: Date.now()
            }, 'DB_TOKEN_UPDATE');
            logger.warn("The UPDATE query did not find a matching account to update. This is unexpected. The user may not exist in the 'accounts' table yet. The adapter should handle creation shortly.", { providerAccountId: account.providerAccountId });
          }
        } catch (error) {
          authLogger.error("Database token update failed", error, 'DB_TOKEN_UPDATE');
          logger.error("Error updating tokens in database during signIn callback.", { error });
        }

        const requiredScopes = [
          "https://www.googleapis.com/auth/spreadsheets",
          "https://www.googleapis.com/auth/drive.file"
        ]
        
        // Get the granted scopes from the account
        const grantedScopes = account.scope?.split(" ") || []
        
        // Log detailed scope validation
        authLogger.scopeValidation(grantedScopes, requiredScopes, account.providerAccountId);
        
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
          }, 'SCOPE_VALIDATION');
          
          // Prevent sign-in by returning false
          // This will redirect to the error page with error=AccessDenied
          return false
        }
        
        authLogger.info("OAuth scope validation passed", {
          requiredScopes,
          grantedScopes,
          providerAccountId: account.providerAccountId,
          timestamp: Date.now()
        }, 'SCOPE_VALIDATION');
      }
      
      authLogger.info("Sign-in callback completed successfully", {
        provider: account?.provider,
        timestamp: Date.now()
      }, 'SIGNIN_CALLBACK');

      return true
    },

    async redirect({ url, baseUrl }) {
      authLogger.info("NextAuth redirect callback", {
        url,
        baseUrl,
        isCallback: url.includes('/api/auth/callback'),
        isRelative: url.startsWith("/"),
        timestamp: Date.now()
      }, 'REDIRECT');

      // If the URL is a callback URL, redirect to dashboard
      if (url.includes('/api/auth/callback')) {
        authLogger.info("Redirecting to dashboard after callback", {
          originalUrl: url,
          redirectTo: `${baseUrl}/dashboard`,
          timestamp: Date.now()
        }, 'REDIRECT');
        return `${baseUrl}/dashboard`
      }
      // Allows relative callback URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`
      // Allows callback URLs on the same origin
      else if (new URL(url).origin === baseUrl) return url
      // Default redirect to dashboard for successful sign-ins
      return `${baseUrl}/dashboard`
    },
    
    async session({ session, user }) {
      authLogger.info("Session callback initiated", {
        hasUser: !!user,
        userId: user?.id,
        userEmail: user?.email,
        hasSessionUser: !!session.user,
        timestamp: Date.now()
      }, 'SESSION_CALLBACK');

      if (session.user) {
        session.user.id = user.id
      }

      try {
        authLogger.debug("Fetching tokens from database for session", {
          userId: user.id,
          timestamp: Date.now()
        }, 'SESSION_TOKEN_FETCH');

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
          const tokenExpiry = rows[0].expires_at * 1000; // Convert to milliseconds
          const isExpired = tokenExpiry < Date.now();
          
          session.accessToken = rows[0].access_token
          session.refreshToken = rows[0].refresh_token
          
          authLogger.info("Session tokens retrieved from database", {
            userId: user.id,
            hasAccessToken: !!rows[0].access_token,
            hasRefreshToken: !!rows[0].refresh_token,
            expiresAt: rows[0].expires_at,
            accessTokenLength: rows[0].access_token?.length,
            isExpired,
            expiresInMinutes: isExpired ? 'EXPIRED' : Math.round((tokenExpiry - Date.now()) / 60000),
            timestamp: Date.now()
          }, 'SESSION_TOKEN_FETCH');
        } else {
          authLogger.warn("No tokens found in database for user session", {
            userId: user.id,
            timestamp: Date.now()
          }, 'SESSION_TOKEN_FETCH');
        }
      } catch (error) {
        authLogger.error("Error fetching tokens from database for session", error, 'SESSION_TOKEN_FETCH');
        console.error("Error fetching tokens from DB for session:", error)
      }

      authLogger.info("Session callback completed", {
        userId: user.id,
        hasAccessToken: !!session.accessToken,
        hasRefreshToken: !!session.refreshToken,
        timestamp: Date.now()
      }, 'SESSION_CALLBACK');

      return session
    },
  },
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST } 