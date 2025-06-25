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
  authLogger.info("getUserGoogleAuth initiated", {
    userId,
    timestamp: Date.now()
  }, 'GOOGLE_AUTH');

  console.log(`--- getUserGoogleAuth for userId: ${userId} ---`);

  // 1. Fetch user's OAuth tokens from the database
  authLogger.info("Fetching tokens from database", {
    userId,
    timestamp: Date.now()
  }, 'GOOGLE_AUTH');

  const { rows } = await db.query(
    `SELECT access_token, refresh_token, expires_at FROM accounts WHERE "userId" = $1 AND provider = 'google'`,
    [userId]
  )

  authLogger.info("Database query completed", {
    userId,
    rowCount: rows.length,
    hasResults: rows.length > 0,
    timestamp: Date.now()
  }, 'GOOGLE_AUTH');

  console.log(`Query result for user ${userId}:`, JSON.stringify(rows, null, 2));

  if (rows.length === 0) {
    authLogger.error("No Google account found in database", {
      userId,
      timestamp: Date.now()
    }, 'GOOGLE_AUTH');
    console.error(`No Google account found for user ID: ${userId}`)
    return null
  }

  const account = rows[0]
  const accessToken = account.access_token
  const refreshToken = account.refresh_token
  const expiryDate = account.expires_at * 1000 // Convert seconds to milliseconds

  authLogger.info("Token details retrieved", {
    userId,
    hasAccessToken: !!accessToken,
    hasRefreshToken: !!refreshToken,
    accessTokenLength: accessToken?.length,
    refreshTokenLength: refreshToken?.length,
    expiryDate,
    isExpired: expiryDate < Date.now(),
    timestamp: Date.now()
  }, 'GOOGLE_AUTH');

  if (!refreshToken) {
    authLogger.error("No refresh token found in database", {
      userId,
      hasAccessToken: !!accessToken,
      timestamp: Date.now()
    }, 'GOOGLE_AUTH');
    console.error(`!!! No refresh token FOUND IN DATABASE for user ID: ${userId}.`);
    return null
  }

  authLogger.info("Refresh token found, proceeding with OAuth client creation", {
    userId,
    timestamp: Date.now()
  }, 'GOOGLE_AUTH');
  console.log(`✅ Found refresh token in database for user ${userId}. Proceeding with auth.`);

  // 2. Create an OAuth2 client with the application's credentials
  authLogger.info("Creating OAuth2 client", {
    userId,
    hasClientId: !!process.env.GOOGLE_CLIENT_ID,
    hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
    hasNextAuthUrl: !!process.env.NEXTAUTH_URL,
    timestamp: Date.now()
  }, 'GOOGLE_AUTH');

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.NEXTAUTH_URL // The redirect URI is not strictly needed for server-side API calls but is good practice
  )

  // 3. Set the user's specific credentials for the client
  authLogger.info("Setting user credentials on OAuth client", {
    userId,
    hasAccessToken: !!accessToken,
    hasRefreshToken: !!refreshToken,
    expiryDate,
    timestamp: Date.now()
  }, 'GOOGLE_AUTH');

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: expiryDate,
  })

  authLogger.info("OAuth2 client created successfully", {
    userId,
    timestamp: Date.now()
  }, 'GOOGLE_AUTH');

  // 4. The googleapis library automatically handles token refreshing.
  // When an API call is made with an expired access token, the client will
  // use the refresh token to get a new access token behind the scenes.

  return oauth2Client
} 