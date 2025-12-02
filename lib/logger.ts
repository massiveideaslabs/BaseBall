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

    // Helper function to convert BigInt values to strings for JSON serialization
    // Handles Proxy objects (like those returned by ethers.js)
    const convertBigInt = (obj: any): any => {
      if (obj === null || obj === undefined) {
        return obj
      }
      if (typeof obj === 'bigint') {
        return obj.toString()
      }
      if (Array.isArray(obj)) {
        return obj.map(convertBigInt)
      }
      if (typeof obj === 'object') {
        const converted: any = {}
        // Handle both regular objects and Proxy objects
        try {
          // Try to get all keys (works for both regular objects and Proxies)
          const keys = Object.keys(obj)
          for (const key of keys) {
            try {
              const value = obj[key]
              converted[key] = convertBigInt(value)
            } catch (e) {
              // If we can't access the property, skip it
              converted[key] = '[unable to access]'
            }
          }
        } catch (e) {
          // If Object.keys fails, try alternative approach
          try {
            for (const key in obj) {
              try {
                converted[key] = convertBigInt(obj[key])
              } catch (err) {
                converted[key] = '[unable to access]'
              }
            }
          } catch (err2) {
            // Last resort: convert to string
            return String(obj)
          }
        }
        return converted
      }
      return obj
    }

    // Convert data safely, handling any BigInt values
    let convertedData: any = undefined
    if (data) {
      try {
        const converted = convertBigInt(data)
        // Double-check: ensure no BigInt values remain
        convertedData = JSON.parse(JSON.stringify(converted, (key, value) => {
          if (typeof value === 'bigint') {
            return value.toString()
          }
          return value
        }))
      } catch (error) {
        // If conversion fails, try to stringify with a fallback
        console.warn('[Logger] Failed to convert data for logging:', error)
        try {
          convertedData = JSON.parse(JSON.stringify(data, (key, value) => {
            if (typeof value === 'bigint') {
              return value.toString()
            }
            if (value && typeof value === 'object' && value.constructor === Object) {
              // Handle plain objects
              return value
            }
            return value
          }))
        } catch (e) {
          // Last resort: convert to string representation
          convertedData = { _error: 'Failed to serialize data', _raw: String(data) }
        }
      }
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component,
      message,
      data: convertedData,
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
      // Use the already-converted data for console output to avoid BigInt issues
      // This ensures we never pass BigInt values to console.log
      const consoleData = convertedData || (() => {
        try {
          return convertBigInt(data)
        } catch (error) {
          return { _conversionError: String(error), _raw: String(data) }
        }
      })()
      
      console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
        `%c${prefix} ${message}`,
        style,
        consoleData
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
  // Convert BigInt values to strings/numbers before logging
  const safeWager = gameData?.wager 
    ? (typeof gameData.wager === 'bigint' ? gameData.wager.toString() : String(gameData.wager))
    : undefined
  const safeDifficulty = gameData?.difficulty !== undefined
    ? (typeof gameData.difficulty === 'bigint' ? Number(gameData.difficulty) : Number(gameData.difficulty))
    : undefined
  
  logger.info('GameState', `Game ${gameId} state transition`, {
    gameId,
    status,
    statusName: ['Pending', 'Active', 'Completed', 'Cancelled'][status] || 'Unknown',
    account,
    host: gameData?.host,
    player: gameData?.player,
    isHost: gameData?.host?.toLowerCase() === account?.toLowerCase(),
    isPlayer: gameData?.player?.toLowerCase() === account?.toLowerCase(),
    wager: safeWager,
    difficulty: safeDifficulty
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

