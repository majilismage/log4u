import { db } from "@/lib/db"
import { google } from "googleapis"
import { Auth } from "googleapis"
import { authLogger } from "@/lib/auth-logger"

/**
 * Creates a Google OAuth2 client authenticated for a specific user.
 * This function is responsible for fetching the user's credentials from the database
 * and setting up the client, including handling token refreshes.
 *
 * @param userId - The ID of the user for whom to create an authenticated client.
 * @returns An authenticated OAuth2 client, or null if credentials are not found.
 */
export async function getUserGoogleAuth(
  userId: string
): Promise<Auth.OAuth2Client | null> {
  // 1. Fetch user's OAuth tokens from the database

  const { rows } = await db.query(
    `SELECT access_token, refresh_token, expires_at FROM accounts WHERE "userId" = $1 AND provider = 'google'`,
    [userId]
  )

  // Query completed

  if (rows.length === 0) {
    authLogger.error("No Google account found in database", {
      userId,
      timestamp: Date.now()
    }, 'AUTH_ERROR');
    return null
  }

  const account = rows[0]
  const accessToken = account.access_token
  const refreshToken = account.refresh_token
  const expiryDate = account.expires_at * 1000 // Convert seconds to milliseconds

  // Token details retrieved

  if (!refreshToken) {
    authLogger.error("No refresh token found in database", {
      userId,
      hasAccessToken: !!accessToken,
      timestamp: Date.now()
    }, 'TOKEN_ERROR');
    return null
  }

  // Refresh token found, proceeding with OAuth client creation

  // 2. Create an OAuth2 client with the application's credentials

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.NEXTAUTH_URL // The redirect URI is not strictly needed for server-side API calls but is good practice
  )

  // 3. Set the user's specific credentials for the client

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: expiryDate,
  })

  // OAuth2 client created successfully

  // 4. The googleapis library automatically handles token refreshing.
  // When an API call is made with an expired access token, the client will
  // use the refresh token to get a new access token behind the scenes.

  return oauth2Client
} 