import { AuthOptions, getServerSession } from "next-auth";
import { google } from "googleapis";
import { db } from "./db";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { logger } from "@/lib/logger";

/**
 * A centralized service for creating authenticated Google API clients
 * using user-specific OAuth tokens.
 */

interface AuthenticatedClientResponse {
  auth: any; // This will be the Google OAuth2 client
  userId: string;
  googleSheetsId?: string;
  googleDriveFolderId?: string;
}

/**
 * Creates an authenticated Google API client for the currently logged-in user.
 * It fetches the user's session, retrieves their OAuth tokens from the database,
 * and configures an OAuth2 client with those tokens.
 *
 * @returns {Promise<AuthenticatedClientResponse>} An object containing the authenticated client and user config IDs.
 * @throws {Error} If no user session is found or if the user's account/config is missing.
 */
export async function getAuthenticatedClient(): Promise<AuthenticatedClientResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    logger.error("getAuthenticatedClient: No session or user ID found.");
    throw new Error("User not authenticated or session is missing user ID.");
  }

  const userId = session.user.id;
  logger.info(`getAuthenticatedClient: Authenticating user ID: ${userId}`);

  // 1. Fetch user's OAuth tokens from the 'accounts' table
  const accountQuery = await db.query(
    `SELECT access_token, refresh_token FROM accounts WHERE "userId" = $1 AND provider = 'google'`,
    [userId]
  );

  if (accountQuery.rows.length === 0) {
    logger.error(`getAuthenticatedClient: No Google account found for user ID: ${userId}`);
    throw new Error(`No Google account found for user ID: ${userId}`);
  }

  const { access_token, refresh_token } = accountQuery.rows[0];
  logger.info(`getAuthenticatedClient: Fetched tokens from DB. Has access_token: ${!!access_token}, Has refresh_token: ${!!refresh_token}`);

  if (!refresh_token) {
    // This is a critical issue. The user might need to re-authenticate.
    logger.error(`getAuthenticatedClient: Missing refresh token for user ID: ${userId}`);
    throw new Error(`Missing refresh token for user ID: ${userId}. Please re-authenticate.`);
  }
  
  // 2. Fetch user's Google configuration from the 'user_google_config' table
  const configQuery = await db.query(
    `SELECT "googleSheetsId", "googleDriveFolderId" FROM user_google_config WHERE "userId" = $1`,
    [userId]
  );
  
  // It's okay if the user has no config yet, so we don't throw an error here.
  const userConfig = configQuery.rows[0] || {};
  const { googleSheetsId, googleDriveFolderId } = userConfig;
  logger.debug(`getAuthenticatedClient: User config found`, { userId, hasSheet: !!googleSheetsId, hasDrive: !!googleDriveFolderId });

  // 3. Create and configure the Google OAuth2 client
  const auth = new google.auth.OAuth2({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  });

  auth.setCredentials({
    access_token: access_token,
    refresh_token: refresh_token,
  });

  try {
    // Force a token refresh to ensure the access_token is valid.
    const { token } = await auth.getAccessToken();
    if (token) {
      auth.setCredentials({ access_token: token });
      logger.info(`getAuthenticatedClient: Successfully refreshed access token for user ID: ${userId}`);
    } else {
      logger.warn(`getAuthenticatedClient: Access token refresh did not return a new token for user ID: ${userId}`);
    }
  } catch (error) {
    logger.error('getAuthenticatedClient: Failed to refresh access token.', { userId, error });
    throw new Error('Could not refresh access token. Please try re-authenticating.');
  }

  // The googleapis library will automatically handle refreshing the access_token
  // if it's expired, as long as a valid refresh_token is provided.

  return {
    auth,
    userId,
    googleSheetsId,
    googleDriveFolderId,
  };
} 