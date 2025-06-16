import NextAuth, { AuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import PostgresAdapter from "@auth/pg-adapter"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"

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
      if (account?.provider === "google") {
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
          logger.info("A new refresh_token was provided by Google. This should happen on the first consent.");
        } else {
          logger.warn("No refresh_token was provided. This is expected on subsequent logins. If you just revoked and re-granted access, this might indicate a configuration issue.");
        }

        // Manually update tokens in the database to ensure they are always fresh.
        try {
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
            logger.info("Successfully updated tokens in the database.", { updatedRow: result.rows[0] });
          } else {
            logger.warn("The UPDATE query did not find a matching account to update. This is unexpected. The user may not exist in the 'accounts' table yet. The adapter should handle creation shortly.", { providerAccountId: account.providerAccountId });
          }
        } catch (error) {
          logger.error("Error updating tokens in database during signIn callback.", { error });
        }

        const requiredScopes = [
          "https://www.googleapis.com/auth/spreadsheets",
          "https://www.googleapis.com/auth/drive.file"
        ]
        
        // Get the granted scopes from the account
        const grantedScopes = account.scope?.split(" ") || []
        
        // Check if all required scopes are granted
        const hasAllRequiredScopes = requiredScopes.every(scope => 
          grantedScopes.includes(scope)
        )
        
        if (!hasAllRequiredScopes) {
          // Prevent sign-in by returning false
          // This will redirect to the error page with error=AccessDenied
          return false
        }
      }
      
      return true
    },

    async redirect({ url, baseUrl }) {
      // If the URL is a callback URL, redirect to dashboard
      if (url.includes('/api/auth/callback')) {
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
      if (session.user) {
        session.user.id = user.id
      }

      try {
        const { rows } = await db.query(
          `
          SELECT access_token, refresh_token
          FROM accounts
          WHERE "userId" = $1 AND provider = 'google'
        `,
          [user.id]
        )

        if (rows && rows.length > 0) {
          session.accessToken = rows[0].access_token
          session.refreshToken = rows[0].refresh_token
        }
      } catch (error) {
        console.error("Error fetching tokens from DB for session:", error)
      }

      return session
    },
  },
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST } 