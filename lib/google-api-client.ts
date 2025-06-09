import { AuthOptions, getServerSession } from "next-auth";
import { google } from "googleapis";
import { db } from "./db";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

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
    throw new Error("User not authenticated or session is missing user ID.");
  }

  const userId = session.user.id;

  // 1. Fetch user's OAuth tokens from the 'accounts' table
  const accountQuery = await db.query(
    `SELECT access_token, refresh_token FROM accounts WHERE "userId" = $1 AND provider = 'google'`,
    [userId]
  );

  if (accountQuery.rows.length === 0) {
    throw new Error(`No Google account found for user ID: ${userId}`);
  }

  const { access_token, refresh_token } = accountQuery.rows[0];

  if (!refresh_token) {
    // This is a critical issue. The user might need to re-authenticate.
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

  // 3. Create and configure the Google OAuth2 client
  const auth = new google.auth.OAuth2({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  });

  auth.setCredentials({
    access_token: access_token,
    refresh_token: refresh_token,
  });

  // The googleapis library will automatically handle refreshing the access_token
  // if it's expired, as long as a valid refresh_token is provided.

  return {
    auth,
    userId,
    googleSheetsId,
    googleDriveFolderId,
  };
} 