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
        logger.info('NextAuth signIn callback: Received account object from Google.', {
          provider: account.provider,
          providerAccountId: account.providerAccountId,
          has_refresh_token: !!account.refresh_token,
          scope: account.scope,
          expires_at: account.expires_at
        });

        if (account.refresh_token) {
          logger.info("NextAuth signIn callback: A refresh_token was provided. The adapter should handle saving it.");
        } else {
          logger.warn("NextAuth signIn callback: No refresh_token was provided by Google. This is expected on subsequent logins. If this is the FIRST login, there may be a configuration issue.");
        }

        // Manually update tokens in the database to ensure they are always fresh.
        try {
          await db.query(
            `
            UPDATE accounts
            SET
              access_token = $1,
              expires_at = $2,
              refresh_token = COALESCE($3, refresh_token)
            WHERE "providerAccountId" = $4
            `,
            [
              account.access_token,
              account.expires_at,
              account.refresh_token,
              account.providerAccountId,
            ]
          );
          logger.info("NextAuth signIn callback: Successfully updated tokens in the database.");
        } catch (error) {
          logger.error("NextAuth signIn callback: Error updating tokens in database.", { error });
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