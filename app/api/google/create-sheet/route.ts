import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUserGoogleAuth } from "@/lib/google-auth";
import { google } from "googleapis";
import { db } from "@/lib/db";

const SPREADSHEET_HEADERS = [
  "Journey ID", "Departure Date", "Arrival Date", "From Town", "From Country",
  "From Latitude", "From Longitude", "To Town", "To Country", "To Latitude",
  "To Longitude", "Distance", "Average Speed", "Max Speed", "Notes",
  "Images Link", "Videos Link", "Timestamp"
];

export async function POST() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const auth = await getUserGoogleAuth(userId);
    if (!auth) {
      return NextResponse.json({ error: "Failed to get Google authentication" }, { status: 500 });
    }

    const sheets = google.sheets({ version: "v4", auth });

    // 1. Create the spreadsheet
    const spreadsheet = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: "WanderNote Log",
        },
      },
    });

    const spreadsheetId = spreadsheet.data.spreadsheetId;
    if (!spreadsheetId) {
      throw new Error("Failed to create spreadsheet.");
    }

    // 2. Add headers to the sheet
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "Sheet1!A1",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [SPREADSHEET_HEADERS],
      },
    });

    // 3. Save the spreadsheet ID to the database
    await db.query(
      `
      INSERT INTO user_google_config ("userId", "googleSheetsId")
      VALUES ($1, $2)
      ON CONFLICT ("userId") DO UPDATE
      SET "googleSheetsId" = $2, "updatedAt" = NOW()
    `,
      [userId, spreadsheetId]
    );

    return NextResponse.json({
      message: "Spreadsheet created successfully!",
      spreadsheetId: spreadsheetId,
      spreadsheetUrl: spreadsheet.data.spreadsheetUrl,
    });
  } catch (error) {
    console.error("Error creating spreadsheet:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json({ error: "Failed to create spreadsheet.", details: errorMessage }, { status: 500 });
  }
} 