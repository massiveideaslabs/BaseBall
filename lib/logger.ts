/**
 * Comprehensive logging utility for debugging BaseBall game
 * Logs are written to both console and can be sent to a remote endpoint if needed
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug'

interface LogEntry {
  timestamp: string
  level: LogLevel
  component: string
  message: string
  data?: any
  stack?: string
}

class Logger {
  private logs: LogEntry[] = []
  private maxLogs = 1000 // Keep last 1000 logs in memory
  private enabled = true

  constructor() {
    // Enable logging in development or if explicitly enabled
    if (typeof window !== 'undefined') {
      this.enabled = process.env.NODE_ENV === 'development' || 
                     localStorage.getItem('baseball_debug') === 'true'
    }
  }

  private addLog(level: LogLevel, component: string, message: string, data?: any) {
    if (!this.enabled) return

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component,
      message,
      data: data ? JSON.parse(JSON.stringify(data)) : undefined,
      stack: level === 'error' && data?.stack ? data.stack : undefined
    }

    this.logs.push(entry)
    
    // Keep only last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs.shift()
    }

    // Console output with styling
    const style = this.getStyle(level)
    const prefix = `[${entry.timestamp}] [${component}]`
    
    if (data) {
      console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
        `%c${prefix} ${message}`,
        style,
        data
      )
    } else {
      console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
        `%c${prefix} ${message}`,
        style
      )
    }

    // Store in window for easy access in browser console
    if (typeof window !== 'undefined') {
      ;(window as any).baseballLogs = this.logs
    }
  }

  private getStyle(level: LogLevel): string {
    const styles: Record<LogLevel, string> = {
      info: 'color: #00ff00; font-weight: bold;',
      warn: 'color: #ffff00; font-weight: bold;',
      error: 'color: #ff0000; font-weight: bold;',
      debug: 'color: #00ffff; font-weight: normal;'
    }
    return styles[level]
  }

  info(component: string, message: string, data?: any) {
    this.addLog('info', component, message, data)
  }

  warn(component: string, message: string, data?: any) {
    this.addLog('warn', component, message, data)
  }

  error(component: string, message: string, error?: any) {
    this.addLog('error', component, error?.message || error || message, error)
  }

  debug(component: string, message: string, data?: any) {
    this.addLog('debug', component, message, data)
  }

  // Get all logs
  getLogs(): LogEntry[] {
    return [...this.logs]
  }

  // Get logs filtered by component
  getLogsByComponent(component: string): LogEntry[] {
    return this.logs.filter(log => log.component === component)
  }

  // Get logs filtered by level
  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter(log => log.level === level)
  }

  // Export logs as JSON
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2)
  }

  // Clear logs
  clearLogs() {
    this.logs = []
    if (typeof window !== 'undefined') {
      ;(window as any).baseballLogs = []
    }
  }

  // Enable/disable logging
  setEnabled(enabled: boolean) {
    this.enabled = enabled
    if (enabled && typeof window !== 'undefined') {
      localStorage.setItem('baseball_debug', 'true')
    } else if (typeof window !== 'undefined') {
      localStorage.removeItem('baseball_debug')
    }
  }
}

// Export singleton instance
export const logger = new Logger()

// Helper function to log game state transitions
export function logGameState(
  gameId: number | null,
  status: number,
  account: string | null | undefined,
  gameData: any
) {
  logger.info('GameState', `Game ${gameId} state transition`, {
    gameId,
    status,
    statusName: ['Pending', 'Active', 'Completed', 'Cancelled'][status] || 'Unknown',
    account,
    host: gameData?.host,
    player: gameData?.player,
    isHost: gameData?.host?.toLowerCase() === account?.toLowerCase(),
    isPlayer: gameData?.player?.toLowerCase() === account?.toLowerCase(),
    wager: gameData?.wager?.toString(),
    difficulty: gameData?.difficulty
  })
}

// Helper function to log socket events
export function logSocketEvent(eventName: string, data: any, direction: 'sent' | 'received' = 'received') {
  logger.debug('Socket', `${direction === 'sent' ? '→' : '←'} ${eventName}`, data)
}

// Helper function to log transaction events
export function logTransaction(action: string, txHash: string | null, gameId?: number) {
  logger.info('Transaction', action, {
    txHash,
    gameId,
    timestamp: Date.now()
  })
}

