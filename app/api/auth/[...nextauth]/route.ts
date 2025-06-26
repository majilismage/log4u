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
          prompt: "select_account consent",
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

        // SECURE MANUAL TOKEN UPDATE - Fixed to prevent user account conflation
        // We need this manual update because NextAuth PostgreSQL adapter doesn't reliably 
        // update tokens on every login (as documented in PROJECT.md), but we must ensure
        // we only update tokens for the correct user to prevent security issues.
        try {
          authLogger.info('Starting secure database token update', {
            providerAccountId: account.providerAccountId,
            profileEmail: profile?.email,
            hasAccessToken: !!account.access_token,
            hasRefreshToken: !!account.refresh_token,
            expiresAt: account.expires_at,
            timestamp: Date.now()
          }, 'SECURE_TOKEN_UPDATE');

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

          if (result.rows.length > 0) {
            authLogger.info("Secure database token update successful", {
              userId: result.rows[0].userId,
              userEmail: result.rows[0].email,
              providerAccountId: account.providerAccountId,
              provider: account.provider,
              rowsUpdated: result.rowCount,
              hasStoredRefreshToken: !!result.rows[0].refresh_token,
              timestamp: Date.now()
            }, 'SECURE_TOKEN_UPDATE');
            logger.info("Successfully updated tokens with security validation.", { 
              userId: result.rows[0].userId,
              userEmail: result.rows[0].email 
            });
          } else {
            authLogger.warn("Secure token update found no matching user-account combination", {
              providerAccountId: account.providerAccountId,
              provider: account.provider,
              profileEmail: profile?.email,
              timestamp: Date.now()
            }, 'SECURE_TOKEN_UPDATE');
            logger.warn("No matching user-account found for secure token update. This could indicate a new user or email mismatch.", { 
              providerAccountId: account.providerAccountId,
              profileEmail: profile?.email 
            });
          }
        } catch (error) {
          authLogger.error("Secure database token update failed", error, 'SECURE_TOKEN_UPDATE');
          logger.error("Error in secure token update during signIn callback.", { error });
        }

        const requiredScopes = [
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
        isSignOut: url.includes('/auth/signin'),
        timestamp: Date.now()
      }, 'REDIRECT');

      // Handle sign-out redirects efficiently
      if (url.includes('/auth/signin')) {
        authLogger.info("Redirect for sign-out detected", {
          originalUrl: url,
          redirectTo: `${baseUrl}/auth/signin`,
          timestamp: Date.now()
        }, 'REDIRECT');
        return `${baseUrl}/auth/signin`;
      }

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
      if (url.startsWith("/")) {
        const finalUrl = `${baseUrl}${url}`;
        authLogger.info("Processing relative URL redirect", {
          originalUrl: url,
          finalUrl,
          timestamp: Date.now()
        }, 'REDIRECT');
        return finalUrl;
      }
      
      // Allows callback URLs on the same origin
      if (new URL(url).origin === baseUrl) {
        authLogger.info("Same-origin redirect", {
          url,
          timestamp: Date.now()
        }, 'REDIRECT');
        return url;
      }
      
      // Default redirect to dashboard for successful sign-ins
      authLogger.info("Default redirect to dashboard", {
        originalUrl: url,
        redirectTo: `${baseUrl}/dashboard`,
        timestamp: Date.now()
      }, 'REDIRECT');
      return `${baseUrl}/dashboard`
    },
    
    async session({ session, user, token }) {
      const hasUser = !!user;
      const hasToken = !!token;
      const sessionExists = !!session;
      
      // Detect potential logout scenario - improved detection
      const isLogoutScenario = (!hasUser || !hasToken) && sessionExists;
      
      authLogger.info(`Session callback initiated${isLogoutScenario ? ' (POTENTIAL LOGOUT)' : ''}`, {
        hasUser,
        hasToken,
        sessionExists,
        userId: user?.id,
        userEmail: user?.email,
        hasSessionUser: !!session?.user,
        isLogoutScenario,
        timestamp: Date.now()
      }, 'SESSION_CALLBACK');

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
              // The secure token update should prevent this scenario
              authLogger.error("Account conflation detected - this should not happen with secure token updates", {
                userId: user.id,
                timestamp: Date.now()
              }, 'SECURITY_VIOLATION');
            } else {
              authLogger.info("User-account validation passed", {
                userId: user.id,
                userEmail: user.email,
                providerAccountId: row.providerAccountId,
                timestamp: Date.now()
              }, 'SECURITY_VALIDATION');
            }
          }
        } catch (error) {
          authLogger.error("Session security validation failed", error, 'SECURITY_VALIDATION');
          // Don't block the session for database errors, but log them
        }
      }

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