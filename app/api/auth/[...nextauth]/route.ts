import NextAuth, { AuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import PostgresAdapter from "@auth/pg-adapter"
import { db } from "@/lib/db"

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
      console.log("--- NextAuth signIn Callback ---");
      console.log("Account object:", JSON.stringify(account, null, 2));

      if (account?.provider === "google") {
        if (account.refresh_token) {
          console.log("✅ Successfully received refresh_token from Google. Manually updating in DB...");
          try {
            await db.query(
              `UPDATE accounts SET refresh_token = $1 WHERE "providerAccountId" = $2`,
              [account.refresh_token, account.providerAccountId]
            );
            console.log("✅ Manual refresh_token update successful.");
          } catch (error) {
            console.error("!!! Error manually updating refresh_token:", error);
          }
        } else {
          console.warn("!!! No refresh_token from Google. User may need to re-revoke access.");
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