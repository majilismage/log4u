import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { google } from 'googleapis';
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUserGoogleAuth } from '@/lib/google-auth';
import { db } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const { rows } = await db.query(
      `SELECT "googleSheetsId", "googleDriveFolderId" FROM user_google_config WHERE "userId" = $1`,
      [userId]
    );

    const config = rows[0] || { googleSheetsId: null, googleDriveFolderId: null };
    
    const auth = await getUserGoogleAuth(userId);
    if (!auth) {
      // Still return the config, but note that auth failed.
      return NextResponse.json({ 
        sheet: config.googleSheetsId ? { id: config.googleSheetsId, url: null, error: "Could not verify." } : null,
        folder: config.googleDriveFolderId ? { id: config.googleDriveFolderId, url: null, error: "Could not verify." } : null,
        error: "Google auth not found" 
      });
    }

    let sheetData = null;
    if (config.googleSheetsId) {
      const sheets = google.sheets({ version: 'v4', auth });
      try {
        const sheetMetadata = await sheets.spreadsheets.get({
          spreadsheetId: config.googleSheetsId,
          fields: 'spreadsheetUrl',
        });
        sheetData = {
          id: config.googleSheetsId,
          url: sheetMetadata.data.spreadsheetUrl,
        };
      } catch (error: any) {
        console.error("Error fetching sheet metadata:", error.message);
        sheetData = { id: config.googleSheetsId, url: null, error: "Sheet not found. It may have been deleted or permissions changed." };
      }
    }

    let folderData = null;
    if (config.googleDriveFolderId) {
      const drive = google.drive({ version: 'v3', auth });
      try {
        const folderMetadata = await drive.files.get({
          fileId: config.googleDriveFolderId,
          fields: 'webViewLink',
        });
        folderData = {
          id: config.googleDriveFolderId,
          url: folderMetadata.data.webViewLink
        };
      } catch (error: any) {
        console.error("Error fetching folder metadata:", error.message);
        folderData = { id: config.googleDriveFolderId, url: null, error: "Folder not found. It may have been deleted or permissions changed." };
      }
    }

    return NextResponse.json({
      sheet: sheetData,
      folder: folderData,
    });

  } catch (error) {
    console.error("Error fetching user Google config:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json({ error: "Failed to fetch config.", details: errorMessage }, { status: 500 });
  }
} 