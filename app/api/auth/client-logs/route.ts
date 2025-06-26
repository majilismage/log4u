import { NextRequest, NextResponse } from "next/server";
import { authLogger } from "@/lib/auth-logger";

export async function POST(req: NextRequest) {
  try {
    const { level, message, data, context, clientTimestamp } = await req.json();
    
    // Forward client log to server auth logger with special prefix
    const logMethod = level.toLowerCase() === 'error' ? 'error' 
      : level.toLowerCase() === 'warn' ? 'warn'
      : level.toLowerCase() === 'debug' ? 'debug'
      : 'info';
    
    authLogger[logMethod](`[CLIENT-FORWARDED] ${message}`, {
      ...data,
      clientTimestamp,
      forwardedAt: Date.now(),
      originalContext: context
    }, `CLIENT_${context}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to forward client log:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
} 