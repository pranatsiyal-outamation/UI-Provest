/**
 * Console logging wrapper with levels, matching the pattern QMS's LoggerService
 * uses (colored labels per level). debug/info are dropped outside dev builds so a
 * production console only ever shows things worth an admin's attention.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const STYLES: Record<LogLevel, string> = {
  debug: 'color: #888',
  info: 'color: #2196f3',
  warn: 'color: #ff9800',
  error: 'color: #f44336',
}

const CONSOLE_METHOD: Record<LogLevel, 'log' | 'info' | 'warn' | 'error'> = {
  debug: 'log',
  info: 'info',
  warn: 'warn',
  error: 'error',
}

function shouldLog(level: LogLevel): boolean {
  if (level === 'debug' || level === 'info') return import.meta.env.DEV
  return true
}

function write(level: LogLevel, message: string, ...args: unknown[]) {
  if (!shouldLog(level)) return
  console[CONSOLE_METHOD[level]](`%c[ProVest Admin] ${level.toUpperCase()}`, STYLES[level], message, ...args)
}

export const logger = {
  debug: (message: string, ...args: unknown[]) => write('debug', message, ...args),
  info: (message: string, ...args: unknown[]) => write('info', message, ...args),
  warn: (message: string, ...args: unknown[]) => write('warn', message, ...args),
  error: (message: string, ...args: unknown[]) => write('error', message, ...args),
}
