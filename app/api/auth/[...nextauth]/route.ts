import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import PostgresAdapter from "@auth/pg-adapter"
import { db } from "@/lib/db"

const handler = NextAuth({
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
          scope:
            "openid email profile https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      // Only check scopes for Google provider
      if (account?.provider === "google") {
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
})

export { handler as GET, handler as POST } 