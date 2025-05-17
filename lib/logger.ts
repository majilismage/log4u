class Logger {
  private isServer: boolean;

  constructor() {
    this.isServer = typeof window === 'undefined';
  }

  private async write(level: string, message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data: data || null
    };

    if (this.isServer) {
      // Server-side logging
      const { writeFile, mkdir } = await import('fs/promises');
      const { join } = await import('path');
      const { format } = await import('date-fns');
      
      try {
        const logDir = join(process.cwd(), 'logs');
        await mkdir(logDir, { recursive: true });
        
        const date = format(new Date(), 'yyyy-MM-dd');
        const logFile = join(logDir, `app-${date}.log`);
        
        const logLine = JSON.stringify(logEntry) + '\n';
        await writeFile(logFile, logLine, { flag: 'a' });
      } catch (error) {
        console.error('Failed to write to log file:', error);
        console.log(JSON.stringify(logEntry));
      }
    } else {
      // Client-side logging
      const logMethod = level.toLowerCase() === 'error' ? 'error' 
        : level.toLowerCase() === 'warn' ? 'warn'
        : level.toLowerCase() === 'debug' ? 'debug'
        : 'info';
      
      console[logMethod](`[${timestamp}] ${level}: ${message}`, data || '');
    }
  }

  info(message: string, data?: any) {
    this.write('INFO', message, data);
  }

  error(message: string, error?: any) {
    this.write('ERROR', message, {
      error: error?.message || error,
      stack: error?.stack
    });
  }

  debug(message: string, data?: any) {
    this.write('DEBUG', message, data);
  }

  warn(message: string, data?: any) {
    this.write('WARN', message, data);
  }
}

export const logger = new Logger(); 