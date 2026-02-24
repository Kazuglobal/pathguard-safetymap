/**
 * Enhanced logging for Mapbox errors and monitoring
 */

type LogLevel = 'error' | 'warn' | 'info' | 'debug'

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: any
  error?: Error
  userId?: string
  sessionId?: string
}

class MapboxLogger {
  private logs: LogEntry[] = []
  private maxLogs: number = 100
  private isDevelopment: boolean

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development'
  }

  private createLogEntry(level: LogLevel, message: string, context?: any, error?: Error): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      error,
      userId: this.getCurrentUserId(),
      sessionId: this.getSessionId()
    }
  }

  private getCurrentUserId(): string | undefined {
    // In a real application, you'd get this from your auth system
    return typeof window !== 'undefined' ? 
      window.localStorage.getItem('userId') || undefined : 
      undefined
  }

  private getSessionId(): string | undefined {
    // Generate or retrieve session ID
    if (typeof window !== 'undefined') {
      let sessionId = window.sessionStorage.getItem('mapbox-session-id')
      if (!sessionId) {
        sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        window.sessionStorage.setItem('mapbox-session-id', sessionId)
      }
      return sessionId
    }
    return undefined
  }

  private addLog(entry: LogEntry) {
    this.logs.push(entry)
    
    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift()
    }

    // Console output in development
    if (this.isDevelopment) {
      const consoleMethod = entry.level === 'error' ? console.error : 
                           entry.level === 'warn' ? console.warn : 
                           console.log

      consoleMethod(`[Mapbox ${entry.level.toUpperCase()}] ${entry.message}`, {
        context: entry.context,
        error: entry.error,
        timestamp: entry.timestamp
      })
    }
  }

  error(message: string, context?: any, error?: Error) {
    const entry = this.createLogEntry('error', message, context, error)
    this.addLog(entry)
  }

  warn(message: string, context?: any) {
    const entry = this.createLogEntry('warn', message, context)
    this.addLog(entry)
  }

  info(message: string, context?: any) {
    const entry = this.createLogEntry('info', message, context)
    this.addLog(entry)
  }

  debug(message: string, context?: any) {
    const entry = this.createLogEntry('debug', message, context)
    this.addLog(entry)
  }

  // Log specific Mapbox events
  tokenValidationFailed(error: string, context?: any) {
    this.error('Mapbox token validation failed', { error, ...context })
  }

  tokenValidationSuccess(context?: any) {
    this.info('Mapbox token validation successful', context)
  }

  styleLoadFailed(styleUrl: string, error: string, context?: any) {
    this.error('Mapbox style load failed', { styleUrl, error, ...context })
  }

  styleLoadSuccess(styleUrl: string, context?: any) {
    this.info('Mapbox style loaded successfully', { styleUrl, ...context })
  }

  rateLimitExceeded(endpoint: string, context?: any) {
    this.warn('Mapbox rate limit exceeded', { endpoint, ...context })
  }

  mapInitializationFailed(error: string, context?: any) {
    this.error('Mapbox map initialization failed', { error, ...context })
  }

  mapInitializationSuccess(context?: any) {
    this.info('Mapbox map initialized successfully', context)
  }

  // Get recent logs for debugging
  getRecentLogs(level?: LogLevel): LogEntry[] {
    return level ? 
      this.logs.filter(log => log.level === level) : 
      this.logs
  }

  // Get logs as JSON for external systems
  getLogsAsJSON(): string {
    return JSON.stringify(this.logs, null, 2)
  }

  // Clear logs
  clearLogs() {
    this.logs = []
  }

  // Get error statistics
  getErrorStats(): { total: number; byLevel: Record<LogLevel, number> } {
    const stats = {
      total: this.logs.length,
      byLevel: {
        error: 0,
        warn: 0,
        info: 0,
        debug: 0
      }
    }

    this.logs.forEach(log => {
      stats.byLevel[log.level]++
    })

    return stats
  }
}

// Global logger instance
export const mapboxLogger = new MapboxLogger()

// Helper function to monitor map errors
export function setupMapboxErrorMonitoring() {
  if (typeof window === 'undefined') return

  // Listen for unhandled errors that might be related to Mapbox
  window.addEventListener('error', (event) => {
    if (event.error && event.error.stack && event.error.stack.includes('mapbox')) {
      mapboxLogger.error('Unhandled Mapbox error', {
        message: event.error.message,
        stack: event.error.stack,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      }, event.error)
    }
  })

  // Listen for unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && typeof event.reason === 'object' && 
        (event.reason.message?.includes('mapbox') || 
         event.reason.stack?.includes('mapbox'))) {
      mapboxLogger.error('Unhandled Mapbox promise rejection', {
        reason: event.reason
      }, event.reason)
    }
  })
}

// Export logger instance as default
export default mapboxLogger