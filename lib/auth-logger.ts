class AuthLogger {
  private isServer: boolean;

  constructor() {
    this.isServer = typeof window === 'undefined';
  }

  private async writeAuthLog(level: string, message: string, data?: any, context?: string) {
    // Only log errors and critical authentication failures
    const criticalContexts = ['ERROR', 'AUTH_ERROR', 'TOKEN_ERROR'];
    const shouldLog = level === 'ERROR' || criticalContexts.includes(context || '');
    
    if (!shouldLog) {
      return; // Skip verbose logging
    }

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
      // Only log critical errors to console
      console.error(`[AUTH-ERROR] ${JSON.stringify(logEntry)}`);
      
      // Write critical errors to file
      try {
        if (typeof process !== 'undefined' && process.versions && process.versions.node) {
          const fs = eval('require("fs")');
          const path = eval('require("path")');
          
          const logDir = path.join(process.cwd(), 'logs');
          if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
          }
          
          const date = new Date().toISOString().split('T')[0];
          const authLogFile = path.join(logDir, `auth-errors-${date}.log`);
          
          const logLine = JSON.stringify(logEntry) + '\n';
          fs.appendFileSync(authLogFile, logLine);
        }
      } catch (error) {
        // Silent fallback for file writing errors
      }
    } else {
      // Only log errors on client-side
      console.error(`[AUTH-ERROR] ${context || 'AUTH'}: ${message}`, data || '');
    }
  }

  private async forwardToServer(level: string, message: string, data?: any, context?: string, clientTimestamp?: string) {
    try {
      await fetch('/api/auth/client-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          level,
          message,
          data,
          context,
          clientTimestamp
        })
      });
    } catch (error) {
      // Silent fail - don't want to break logout flow
      console.warn('Failed to forward log to server:', error);
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

  // Specialized logout tracking
  logoutInitiated(userId?: string, trigger: 'user_menu' | 'auth_wrapper' | 'manual' = 'user_menu') {
    this.info('Logout process initiated', {
      userId,
      trigger,
      timestamp: Date.now()
    }, 'LOGOUT');
  }

  logoutCompleted(userId?: string, duration?: number) {
    this.info('Logout process completed', {
      userId,
      duration,
      timestamp: Date.now()
    }, 'LOGOUT');
  }

  cleanupOperation(operation: string, success: boolean, details?: any) {
    this.info(`Cleanup operation: ${operation}`, {
      operation,
      success,
      details,
      timestamp: Date.now()
    }, 'CLEANUP');
  }
}

// Export singleton instance
export const authLogger = new AuthLogger(); 