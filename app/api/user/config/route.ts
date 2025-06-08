import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { Session } from "next-auth"

type UserSession = Session & {
  user: {
    id: string
    name?: string | null
    email?: string | null
    image?: string | null
  }
}

export async function GET(req: NextRequest) {
  const session = (await getServerSession(authOptions)) as UserSession | null

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = session.user.id

  try {
    const { rows } = await db.query(
      `SELECT "googleSheetsId", "googleDriveFolderId" FROM user_google_config WHERE "userId" = $1`,
      [userId]
    )

    if (rows.length > 0) {
      return NextResponse.json({
        googleSheetsId: rows[0].googleSheetsId,
        googleDriveFolderId: rows[0].googleDriveFolderId,
      })
    } else {
      return NextResponse.json({
        googleSheetsId: null,
        googleDriveFolderId: null,
      })
    }
  } catch (error) {
    console.error("Error fetching user config:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  const session = (await getServerSession(authOptions)) as UserSession | null

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = session.user.id

  try {
    const body = await req.json()
    const { googleSheetId, googleDriveFolderId } = body

    if (!googleSheetId || !googleDriveFolderId) {
      return NextResponse.json(
        { error: "googleSheetId and googleDriveFolderId are required" },
        { status: 400 }
      )
    }

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

    return NextResponse.json({ message: "Configuration saved successfully" })
  } catch (error) {
    console.error("Error saving user config:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
} 