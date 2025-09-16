/**
 * Optimized logging utility for KSeF client
 */

export interface LoggerOptions {
  debug?: boolean;
  prefix?: string;
  enabledLevels?: ('debug' | 'info' | 'warn' | 'error')[];
}

export class Logger {
  private options: Required<LoggerOptions>;

  constructor(options: LoggerOptions = {}) {
    this.options = {
      debug: options.debug ?? false,
      prefix: options.prefix ?? '[KSeF Client]',
      enabledLevels: options.enabledLevels ?? ['error', 'warn', 'info', 'debug']
    };
  }

  debug(message: string, ...args: any[]): void {
    if (this.options.debug && this.options.enabledLevels.includes('debug')) {
      console.debug(`${this.options.prefix} ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.options.enabledLevels.includes('info')) {
      console.info(`${this.options.prefix} ${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.options.enabledLevels.includes('warn')) {
      console.warn(`${this.options.prefix} ${message}`, ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.options.enabledLevels.includes('error')) {
      console.error(`${this.options.prefix} ${message}`, ...args);
    }
  }

  updateOptions(newOptions: Partial<LoggerOptions>): void {
    this.options = { ...this.options, ...newOptions };
  }

  /**
   * Create a child logger with additional prefix
   */
  child(prefix: string): Logger {
    return new Logger({
      ...this.options,
      prefix: `${this.options.prefix}:${prefix}`
    });
  }
}

/**
 * Default logger instance
 */
export const defaultLogger = new Logger();

/**
 * Create optimized logger for production use (minimal logging)
 */
export function createProductionLogger(): Logger {
  return new Logger({
    debug: false,
    enabledLevels: ['error', 'warn']
  });
}

/**
 * Create logger optimized for AWS Lambda (structured logging)
 */
export function createLambdaLogger(): Logger {
  return new Logger({
    debug: false,
    prefix: '',
    enabledLevels: ['error', 'warn', 'info']
  });
} 