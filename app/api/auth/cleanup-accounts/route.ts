import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { authLogger } from "@/lib/auth-logger";
import { db } from "@/lib/db";

/**
 * API endpoint to detect and clean up potential account conflicts
 * This endpoint helps maintain database integrity by identifying:
 * 1. Orphaned OAuth accounts (accounts without corresponding users)
 * 2. Conflicted accounts (OAuth accounts linked to wrong users)
 * 3. Duplicate provider accounts for the same user
 */
export async function POST(req: NextRequest) {
  try {
    authLogger.info("Account cleanup requested", {
      timestamp: Date.now()
    }, 'ACCOUNT_CLEANUP');

    const session = await getServerSession(authOptions);
    
    // Only allow admin users or authenticated users to run cleanup
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    authLogger.info("Starting account integrity check", {
      requestedBy: session.user.id,
      userEmail: session.user.email,
      timestamp: Date.now()
    }, 'ACCOUNT_CLEANUP');

    // 1. Find orphaned OAuth accounts (accounts without corresponding users)
    const orphanedAccounts = await db.query(`
      SELECT a.id, a."userId", a."providerAccountId", a.provider
      FROM accounts a
      LEFT JOIN users u ON a."userId" = u.id
      WHERE u.id IS NULL
    `);

    authLogger.info("Orphaned accounts check completed", {
      orphanedCount: orphanedAccounts.rows.length,
      orphanedAccounts: orphanedAccounts.rows,
      timestamp: Date.now()
    }, 'ACCOUNT_CLEANUP');

    // 2. Find potential email conflicts (users with different emails than their OAuth profile)
    const emailConflicts = await db.query(`
      SELECT u.id, u.email as user_email, a."providerAccountId", a.provider
      FROM users u
      JOIN accounts a ON u.id = a."userId"
      WHERE a.provider = 'google'
    `);

    const conflicts = [];
    for (const row of emailConflicts.rows) {
      // We can't directly check OAuth profile email from the database,
      // but we can log the accounts for manual review
      conflicts.push({
        userId: row.id,
        userEmail: row.user_email,
        providerAccountId: row.providerAccountId,
        provider: row.provider
      });
    }

    authLogger.info("Email conflict check completed", {
      totalAccounts: emailConflicts.rows.length,
      potentialConflicts: conflicts.length,
      conflicts: conflicts,
      timestamp: Date.now()
    }, 'ACCOUNT_CLEANUP');

    // 3. Find duplicate provider accounts for same user
    const duplicateAccounts = await db.query(`
      SELECT "userId", provider, COUNT(*) as account_count
      FROM accounts
      WHERE provider = 'google'
      GROUP BY "userId", provider
      HAVING COUNT(*) > 1
    `);

    authLogger.info("Duplicate accounts check completed", {
      duplicateUsers: duplicateAccounts.rows.length,
      duplicates: duplicateAccounts.rows,
      timestamp: Date.now()
    }, 'ACCOUNT_CLEANUP');

    // Prepare cleanup report
    const cleanupReport = {
      orphanedAccounts: orphanedAccounts.rows.length,
      potentialEmailConflicts: conflicts.length,
      duplicateProviderAccounts: duplicateAccounts.rows.length,
      details: {
        orphaned: orphanedAccounts.rows,
        conflicts: conflicts,
        duplicates: duplicateAccounts.rows
      },
      timestamp: new Date().toISOString()
    };

    authLogger.info("Account cleanup analysis completed", cleanupReport, 'ACCOUNT_CLEANUP');

    return NextResponse.json({
      message: "Account integrity check completed",
      report: cleanupReport,
      actions: {
        recommendedActions: [
          orphanedAccounts.rows.length > 0 ? "Remove orphaned OAuth accounts" : null,
          duplicateAccounts.rows.length > 0 ? "Consolidate duplicate provider accounts" : null,
          conflicts.length > 0 ? "Review potential email conflicts manually" : null
        ].filter(Boolean)
      }
    });

  } catch (error) {
    authLogger.error("Account cleanup failed", error, 'ACCOUNT_CLEANUP');
    return NextResponse.json(
      { error: "Account cleanup failed", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check account integrity without making changes
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Just check the current user's account integrity
    const userAccountCheck = await db.query(`
      SELECT u.id, u.email, u.name, a."providerAccountId", a.provider, a.access_token IS NOT NULL as has_token
      FROM users u
      LEFT JOIN accounts a ON u.id = a."userId"
      WHERE u.id = $1
    `, [session.user.id]);

    authLogger.info("Individual user account check", {
      userId: session.user.id,
      userEmail: session.user.email,
      accountsFound: userAccountCheck.rows.length,
      accounts: userAccountCheck.rows,
      timestamp: Date.now()
    }, 'ACCOUNT_CHECK');

    return NextResponse.json({
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name
      },
      accounts: userAccountCheck.rows,
      integrity: {
        hasGoogleAccount: userAccountCheck.rows.some(row => row.provider === 'google'),
        hasValidTokens: userAccountCheck.rows.some(row => row.has_token),
        accountCount: userAccountCheck.rows.length
      }
    });

  } catch (error) {
    authLogger.error("Individual account check failed", error, 'ACCOUNT_CHECK');
    return NextResponse.json(
      { error: "Account check failed", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 