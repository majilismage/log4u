import { AuthOptions, getServerSession } from "next-auth";
import { google } from "googleapis";
import { db } from "./db";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { logger } from "@/lib/logger";
import { authLogger } from "@/lib/auth-logger";

/**
 * A centralized service for creating authenticated Google API clients
 * using user-specific OAuth tokens.
 */

interface AuthenticatedClientResponse {
  auth: any; // This will be the Google OAuth2 client
  userId: string;
  googleSheetsId?: string;
  googleDriveFolderId?: string;
  unitPreferences?: {
    speedUnit: string;
    distanceUnit: string;
  };
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
  authLogger.info("getAuthenticatedClient called", {
    timestamp: Date.now()
  }, 'GOOGLE_API_CLIENT');

  const session = await getServerSession(authOptions);
  
  authLogger.info("Server session retrieved", {
    hasSession: !!session,
    hasUser: !!session?.user,
    userId: session?.user?.id,
    userEmail: session?.user?.email,
    timestamp: Date.now()
  }, 'GOOGLE_API_CLIENT');

  if (!session?.user?.id) {
    authLogger.error("No session or user ID found in getAuthenticatedClient", {
      hasSession: !!session,
      hasUser: !!session?.user,
      timestamp: Date.now()
    }, 'GOOGLE_API_CLIENT');
    logger.error("getAuthenticatedClient: No session or user ID found.");
    throw new Error("User not authenticated or session is missing user ID.");
  }

  const userId = session.user.id;
  authLogger.info("Authenticating user for Google API", {
    userId,
    userEmail: session.user.email,
    timestamp: Date.now()
  }, 'GOOGLE_API_CLIENT');
  logger.info(`getAuthenticatedClient: Authenticating user ID: ${userId}`);

  // 1. Fetch user's OAuth tokens from the 'accounts' table
  authLogger.info("Fetching OAuth tokens from accounts table", {
    userId,
    timestamp: Date.now()
  }, 'GOOGLE_API_CLIENT');

  const accountQuery = await db.query(
    `SELECT access_token, refresh_token FROM accounts WHERE "userId" = $1 AND provider = 'google'`,
    [userId]
  );

  authLogger.info("Accounts table query completed", {
    userId,
    rowCount: accountQuery.rows.length,
    hasResults: accountQuery.rows.length > 0,
    timestamp: Date.now()
  }, 'GOOGLE_API_CLIENT');

  if (accountQuery.rows.length === 0) {
    authLogger.error("No Google account found in accounts table", {
      userId,
      timestamp: Date.now()
    }, 'GOOGLE_API_CLIENT');
    logger.error(`getAuthenticatedClient: No Google account found for user ID: ${userId}`);
    throw new Error(`No Google account found for user ID: ${userId}`);
  }

  const { access_token, refresh_token } = accountQuery.rows[0];
  
  authLogger.info("OAuth tokens retrieved from database", {
    userId,
    hasAccessToken: !!access_token,
    hasRefreshToken: !!refresh_token,
    accessTokenLength: access_token?.length,
    refreshTokenLength: refresh_token?.length,
    timestamp: Date.now()
  }, 'GOOGLE_API_CLIENT');

  logger.info(`getAuthenticatedClient: Fetched tokens from DB. Has access_token: ${!!access_token}, Has refresh_token: ${!!refresh_token}`);

  if (!refresh_token) {
    // This is a critical issue. The user might need to re-authenticate.
    authLogger.error("Missing refresh token - user needs re-authentication", {
      userId,
      hasAccessToken: !!access_token,
      timestamp: Date.now()
    }, 'GOOGLE_API_CLIENT');
    logger.error(`getAuthenticatedClient: Missing refresh token for user ID: ${userId}`);
    throw new Error(`Missing refresh token for user ID: ${userId}. Please re-authenticate.`);
  }
  
  // 2. Fetch user's Google configuration from the 'user_google_config' table
  const configQuery = await db.query(
    `SELECT "googleSheetsId", "googleDriveFolderId", "speedUnit", "distanceUnit" FROM user_google_config WHERE "userId" = $1`,
    [userId]
  );
  
  // It's okay if the user has no config yet, so we don't throw an error here.
  const userConfig = configQuery.rows[0] || {};
  const { googleSheetsId, googleDriveFolderId, speedUnit, distanceUnit } = userConfig;
  logger.debug(`getAuthenticatedClient: User config found`, { userId, hasSheet: !!googleSheetsId, hasDrive: !!googleDriveFolderId, hasUnits: !!(speedUnit && distanceUnit) });

  // 3. Create and configure the Google OAuth2 client
  const auth = new google.auth.OAuth2({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  });

  auth.setCredentials({
    access_token,
    refresh_token,
  });

  // Listen for token refresh events. This is the modern way to handle token updates.
  // If the access token is expired, the library will automatically refresh it on the next API call.
  // This listener ensures that if a new token is issued, we can capture it.
  auth.on('tokens', (tokens) => {
    authLogger.tokenRefresh(userId, 'success');
    authLogger.info("Token refresh event received", {
      userId,
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiryDate: tokens.expiry_date,
      timestamp: Date.now()
    }, 'TOKEN_REFRESH');

    logger.info(`Tokens event received for user ID: ${userId}`);
    // Update the auth client with the new tokens for the current request
    auth.setCredentials(tokens);
    
    // Asynchronously update the tokens in the database for future requests
    db.query(
      `UPDATE accounts SET
         access_token = $1,
         refresh_token = COALESCE($2, refresh_token),
         expires_at = $3
       WHERE "userId" = $4 AND provider = 'google'`,
      [tokens.access_token, tokens.refresh_token, tokens.expiry_date, userId]
    ).then((result) => {
      authLogger.dbTokenUpdate(userId, 'update', result);
      logger.info(`Successfully updated tokens in DB for user ID: ${userId} via 'tokens' event.`);
    }).catch(err => {
      authLogger.error("Failed to update tokens in DB via tokens event", err, 'TOKEN_REFRESH');
      logger.error(`Error updating tokens in DB for user ID: ${userId} via 'tokens' event.`, { error: err });
    });
  });

  try {
    authLogger.tokenRefresh(userId, 'start');
    authLogger.info("Attempting proactive token refresh", {
      userId,
      timestamp: Date.now()
    }, 'TOKEN_REFRESH');

    // Proactively refresh the token if it's expired. This will trigger the 'tokens' event if a refresh happens.
    // The googleapis library is smart enough to only make a network request if the token is actually expired.
    await auth.getAccessToken();

    authLogger.info("Access token validated/refreshed successfully", {
      userId,
      timestamp: Date.now()
    }, 'TOKEN_REFRESH');
    logger.info(`getAuthenticatedClient: Access token is valid or was refreshed for user ID: ${userId}`);
  } catch (error) {
    authLogger.tokenRefresh(userId, 'error', error);
    authLogger.error("Failed to refresh access token", error, 'TOKEN_REFRESH');
    logger.error('getAuthenticatedClient: Failed to refresh access token.', { userId, error });
    throw new Error('Could not refresh access token. The refresh token might be revoked. Please try re-authenticating.');
  }

  authLogger.info("getAuthenticatedClient completed successfully", {
    userId,
    hasGoogleSheetsId: !!googleSheetsId,
    hasGoogleDriveFolderId: !!googleDriveFolderId,
    timestamp: Date.now()
  }, 'GOOGLE_API_CLIENT');

  return {
    auth,
    userId,
    googleSheetsId,
    googleDriveFolderId,
    unitPreferences: (speedUnit && distanceUnit) ? {
      speedUnit,
      distanceUnit,
    } : undefined,
  };
} 