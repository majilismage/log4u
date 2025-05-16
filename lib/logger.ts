import fs from 'fs';
import path from 'path';
import { format } from 'date-fns';

class Logger {
  private logFile: string;

  constructor() {
    const logDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    const date = format(new Date(), 'yyyy-MM-dd');
    this.logFile = path.join(logDir, `app-${date}.log`);
  }

  private write(level: string, message: string, data?: any) {
    const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss.SSS');
    const logEntry = {
      timestamp,
      level,
      message,
      data: data || null
    };

    const logLine = JSON.stringify(logEntry) + '\n';
    fs.appendFileSync(this.logFile, logLine);
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