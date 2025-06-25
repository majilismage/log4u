class AuthLogger {
  private isServer: boolean;

  constructor() {
    this.isServer = typeof window === 'undefined';
  }

  private async writeAuthLog(level: string, message: string, data?: any, context?: string) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      context: context || 'AUTH',
      message,
      data: data || null,
      sessionId: this.isServer ? 'server' : this.generateClientSessionId()
    };

    if (this.isServer) {
      // Server-side logging - use console for now to avoid fs/promises bundling issues
      console.log(`[AUTH-SERVER] ${JSON.stringify(logEntry)}`);
      
      // Attempt to write to file if possible (only in server environment)
      try {
        if (typeof process !== 'undefined' && process.versions && process.versions.node) {
          // Only try to write to file if we have access to process
          const fs = eval('require("fs")');
          const path = eval('require("path")');
          
          const logDir = path.join(process.cwd(), 'logs');
          if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
          }
          
          const date = new Date().toISOString().split('T')[0];
          const authLogFile = path.join(logDir, `auth-${date}.log`);
          
          const logLine = JSON.stringify(logEntry) + '\n';
          fs.appendFileSync(authLogFile, logLine);
        }
      } catch (error) {
        // Silent fallback - just use console logging
        console.error('Failed to write to auth log file:', error);
      }
    } else {
      // Client-side auth logging with special prefix
      const logMethod = level.toLowerCase() === 'error' ? 'error' 
        : level.toLowerCase() === 'warn' ? 'warn'
        : level.toLowerCase() === 'debug' ? 'debug'
        : 'info';
      
      console[logMethod](`[AUTH-CLIENT-${timestamp}] ${context || 'AUTH'}: ${message}`, data || '');
    }
  }

  private generateClientSessionId(): string {
    // Generate or retrieve a client-side session identifier
    if (typeof window !== 'undefined') {
      let sessionId = sessionStorage.getItem('auth-session-id');
      if (!sessionId) {
        sessionId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        sessionStorage.setItem('auth-session-id', sessionId);
      }
      return sessionId;
    }
    return 'unknown-client';
  }

  info(message: string, data?: any, context?: string) {
    this.writeAuthLog('INFO', message, data, context);
  }

  error(message: string, error?: any, context?: string) {
    this.writeAuthLog('ERROR', message, {
      error: error?.message || error,
      stack: error?.stack,
      name: error?.name
    }, context);
  }

  debug(message: string, data?: any, context?: string) {
    this.writeAuthLog('DEBUG', message, data, context);
  }

  warn(message: string, data?: any, context?: string) {
    this.writeAuthLog('WARN', message, data, context);
  }

  // Specialized auth flow tracking methods
  signInAttempt(provider: string, callbackUrl?: string) {
    this.info('Sign-in attempt initiated', {
      provider,
      callbackUrl,
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
      timestamp: Date.now()
    }, 'SIGNIN');
  }

  oauthCallback(params: any) {
    this.info('OAuth callback received', {
      params,
      hasCode: !!params.code,
      hasError: !!params.error,
      state: params.state
    }, 'OAUTH_CALLBACK');
  }

  tokenRefresh(userId: string, status: 'start' | 'success' | 'error', error?: any) {
    this.info(`Token refresh ${status}`, {
      userId,
      error: error?.message,
      timestamp: Date.now()
    }, 'TOKEN_REFRESH');
  }

  sessionChange(status: 'loading' | 'authenticated' | 'unauthenticated', session?: any) {
    const isLogout = status === 'unauthenticated' && !session;
    this.info(`Session status changed to: ${status}${isLogout ? ' (LOGOUT DETECTED)' : ''}`, {
      status,
      hasUser: !!session?.user,
      userId: session?.user?.id,
      userEmail: session?.user?.email,
      hasAccessToken: !!session?.accessToken,
      hasRefreshToken: !!session?.refreshToken,
      isLogout,
      timestamp: Date.now()
    }, 'SESSION');
  }

  scopeValidation(grantedScopes: string[], requiredScopes: string[], userId?: string) {
    this.info('OAuth scope validation', {
      grantedScopes,
      requiredScopes,
      hasAllRequired: requiredScopes.every(scope => grantedScopes.includes(scope)),
      userId,
      timestamp: Date.now()
    }, 'SCOPES');
  }

  dbTokenUpdate(userId: string, operation: 'insert' | 'update', result: any) {
    this.info(`Database token ${operation}`, {
      userId,
      operation,
      success: !!result,
      rowCount: result?.rowCount,
      timestamp: Date.now()
    }, 'DB_TOKEN');
  }
}

// Export singleton instance
export const authLogger = new AuthLogger(); 