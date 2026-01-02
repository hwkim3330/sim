/**
 * @simi/core - Logger
 * Configurable logging utility
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  data?: unknown;
  tag?: string;
}

export interface LoggerOptions {
  level?: LogLevel;
  prefix?: string;
  timestamp?: boolean;
  colors?: boolean;
}

const COLORS = {
  reset: '\x1b[0m',
  debug: '\x1b[36m', // cyan
  info: '\x1b[32m',  // green
  warn: '\x1b[33m',  // yellow
  error: '\x1b[31m', // red
};

/**
 * Logger class with configurable levels and formatting
 */
export class Logger {
  private level: LogLevel;
  private prefix: string;
  private showTimestamp: boolean;
  private useColors: boolean;
  private history: LogEntry[] = [];
  private maxHistory = 100;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? LogLevel.INFO;
    this.prefix = options.prefix ?? 'Simi';
    this.showTimestamp = options.timestamp ?? true;
    this.useColors = options.colors ?? (typeof process !== 'undefined');
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }

  private format(level: string, message: string): string {
    const parts: string[] = [];

    if (this.showTimestamp) {
      parts.push(`[${new Date().toISOString()}]`);
    }

    parts.push(`[${this.prefix}]`);
    parts.push(`[${level.toUpperCase()}]`);
    parts.push(message);

    return parts.join(' ');
  }

  private log(level: LogLevel, levelName: string, message: string, data?: unknown): void {
    if (level < this.level) return;

    const formatted = this.format(levelName, message);
    const entry: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
      data,
    };

    this.history.push(entry);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    const color = this.useColors ? COLORS[levelName as keyof typeof COLORS] : '';
    const reset = this.useColors ? COLORS.reset : '';

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(`${color}${formatted}${reset}`, data ?? '');
        break;
      case LogLevel.INFO:
        console.info(`${color}${formatted}${reset}`, data ?? '');
        break;
      case LogLevel.WARN:
        console.warn(`${color}${formatted}${reset}`, data ?? '');
        break;
      case LogLevel.ERROR:
        console.error(`${color}${formatted}${reset}`, data ?? '');
        break;
    }
  }

  debug(message: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, 'debug', message, data);
  }

  info(message: string, data?: unknown): void {
    this.log(LogLevel.INFO, 'info', message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log(LogLevel.WARN, 'warn', message, data);
  }

  error(message: string, data?: unknown): void {
    this.log(LogLevel.ERROR, 'error', message, data);
  }

  getHistory(): LogEntry[] {
    return [...this.history];
  }

  clearHistory(): void {
    this.history = [];
  }

  /**
   * Create a child logger with a different prefix
   */
  child(prefix: string): Logger {
    return new Logger({
      level: this.level,
      prefix: `${this.prefix}:${prefix}`,
      timestamp: this.showTimestamp,
      colors: this.useColors,
    });
  }
}

// Default logger instance
export const logger = new Logger();
