import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { getUserGoogleAuth } from "@/lib/google-auth"
import { google } from "googleapis"
import { db } from "@/lib/db"
import { Session } from "next-auth"

type UserSession = Session & {
  user: {
    id: string
  }
}

export async function POST() {
  const session = (await getServerSession(authOptions)) as UserSession | null
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = session.user.id

  try {
    const auth = await getUserGoogleAuth(userId)
    if (!auth) {
      return NextResponse.json(
        { error: "Failed to authenticate with Google" },
        { status: 500 }
      )
    }

    const drive = google.drive({ version: "v3", auth })
    const sheets = google.sheets({ version: "v4", auth })

    // 1. Create Google Drive Folder
    const driveFolder = await drive.files.create({
      requestBody: {
        name: "WanderNote App Data",
        mimeType: "application/vnd.google-apps.folder",
      },
      fields: "id",
    })
    const googleDriveFolderId = driveFolder.data.id
    if (!googleDriveFolderId) {
      throw new Error("Failed to create Google Drive folder.")
    }

    // 2. Create Google Sheet
    const spreadsheet = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: "WanderNote Travel Log",
        },
      },
      fields: "spreadsheetId",
    })
    const googleSheetId = spreadsheet.data.spreadsheetId
    if (!googleSheetId) {
      throw new Error("Failed to create Google Sheet.")
    }

    // 3. Save configuration to the database
    await db.query(
      `
      INSERT INTO user_google_config ("userId", "googleSheetsId", "googleDriveFolderId")
      VALUES ($1, $2, $3)
      ON CONFLICT ("userId")
      DO UPDATE SET
        "googleSheetsId" = EXCLUDED."googleSheetsId",
        "googleDriveFolderId" = EXCLUDED."googleDriveFolderId",
        "updatedAt" = NOW()
    `,
      [userId, googleSheetId, googleDriveFolderId]
    )

    return NextResponse.json({
      message: "Setup successful!",
      googleSheetId,
      googleDriveFolderId,
    })
  } catch (error) {
    console.error("Error during setup:", error)
    return NextResponse.json(
      { error: "An error occurred during the setup process." },
      { status: 500 }
    )
  }
} 