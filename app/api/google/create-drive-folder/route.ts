import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUserGoogleAuth } from "@/lib/google-auth";
import { google } from "googleapis";
import { db } from "@/lib/db";

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

    const drive = google.drive({ version: "v3", auth });

    const fileMetadata = {
      name: "WanderNote Media",
      mimeType: "application/vnd.google-apps.folder",
    };

    const folder = await drive.files.create({
      requestBody: fileMetadata,
      fields: "id, webViewLink",
    });

    const folderId = folder.data.id;
    if (!folderId) {
      throw new Error("Failed to create Google Drive folder.");
    }
    
    await db.query(
      `
      INSERT INTO user_google_config ("userId", "googleDriveFolderId")
      VALUES ($1, $2)
      ON CONFLICT ("userId") DO UPDATE
      SET "googleDriveFolderId" = $2, "updatedAt" = NOW()
    `,
      [userId, folderId]
    );

    return NextResponse.json({
      message: "Google Drive folder created successfully!",
      folderId: folderId,
      folderUrl: folder.data.webViewLink,
    });
  } catch (error) {
    console.error("Error creating Google Drive folder:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json({ error: "Failed to create folder.", details: errorMessage }, { status: 500 });
  }
} 