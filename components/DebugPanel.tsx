'use client'

import { useState, useEffect } from 'react'
import { logger } from '@/lib/logger'

interface LogEntry {
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'debug'
  component: string
  message: string
  data?: any
  stack?: string
}

export default function DebugPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [filter, setFilter] = useState<string>('all')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [mounted, setMounted] = useState(false)

  // Ensure debug panel is always visible - log on mount
  useEffect(() => {
    setMounted(true)
    console.log('[DebugPanel] Component mounted - button should be visible')
    console.log('[DebugPanel] To manually open debug panel, run: window.openDebugPanel()')
    // Force enable logging
    if (typeof window !== 'undefined') {
      localStorage.setItem('baseball_debug', 'true')
      // Expose function to open panel from console
      ;(window as any).openDebugPanel = () => {
        console.log('[DebugPanel] Opening panel from console')
        setIsOpen(true)
      }
    }
  }, [])

  useEffect(() => {
    if (isOpen && autoRefresh) {
      const interval = setInterval(() => {
        setLogs(logger.getLogs())
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [isOpen, autoRefresh])

  useEffect(() => {
    if (isOpen) {
      setLogs(logger.getLogs())
    }
  }, [isOpen])

  // Don't render until mounted to avoid hydration issues
  // IMPORTANT: This check must come AFTER all hooks to follow Rules of Hooks
  if (!mounted) {
    return null
  }

  const filteredLogs = filter === 'all' 
    ? logs 
    : logs.filter((log: LogEntry) => log.component === filter || log.level === filter)

  const components = Array.from(new Set(logs.map((log: LogEntry) => log.component)))
  const levels = ['info', 'warn', 'error', 'debug'] as const

  const exportLogs = () => {
    const dataStr = logger.exportLogs()
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `baseball-logs-${Date.now()}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const clearLogs = () => {
    if (confirm('Clear all logs?')) {
      logger.clearLogs()
      setLogs([])
    }
  }

  if (!isOpen) {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: '16px',
          right: '16px',
          zIndex: 99999,
          pointerEvents: 'auto'
        }}
      >
        <button
          onClick={() => {
            console.log('[DebugPanel] Button clicked - opening panel')
            setIsOpen(true)
          }}
          style={{ 
            fontSize: '14px', 
            padding: '10px 20px',
            backgroundColor: '#00ff00',
            color: '#0a0a0a',
            border: '4px solid #00ff00',
            cursor: 'pointer',
            minWidth: '100px',
            fontWeight: 'bold',
            boxShadow: '0 0 10px rgba(0, 255, 0, 0.5)',
            fontFamily: '"Press Start 2P", "Courier New", monospace'
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLButtonElement).style.backgroundColor = '#00cc00'
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLButtonElement).style.backgroundColor = '#00ff00'
          }}
        >
          🐛 DEBUG
        </button>
      </div>
    )
  }

  return (
    <div 
      className="fixed bottom-4 right-4 w-96 max-h-96 bg-retro-bg pixel-border overflow-hidden flex flex-col"
      style={{
        zIndex: 9999,
        position: 'fixed',
        bottom: '16px',
        right: '16px'
      }}
    >
      <div className="bg-retro-green text-retro-bg p-2 flex justify-between items-center">
        <span className="font-bold">DEBUG LOGS</span>
        <div className="flex gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="text-xs px-2 py-1 bg-retro-bg text-retro-green"
            style={{ fontSize: '10px' }}
          >
            {autoRefresh ? 'AUTO' : 'MANUAL'}
          </button>
          <button
            onClick={exportLogs}
            className="text-xs px-2 py-1 bg-retro-bg text-retro-green"
            style={{ fontSize: '10px' }}
          >
            EXPORT
          </button>
          <button
            onClick={clearLogs}
            className="text-xs px-2 py-1 bg-retro-bg text-retro-green"
            style={{ fontSize: '10px' }}
          >
            CLEAR
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="text-xs px-2 py-1 bg-retro-bg text-retro-green"
            style={{ fontSize: '10px' }}
          >
            ✕
          </button>
        </div>
      </div>
      
      <div className="p-2 border-b-2 border-retro-green flex gap-2 flex-wrap">
          <select
          value={filter}
          onChange={(e) => setFilter((e.target as HTMLSelectElement).value)}
          className="bg-retro-bg text-retro-green pixel-border text-xs p-1"
          style={{ fontSize: '10px' }}
        >
          <option value="all">All</option>
          {components.map(comp => (
            <option key={comp} value={comp}>{comp}</option>
          ))}
          {levels.map(level => (
            <option key={level} value={level}>{level.toUpperCase()}</option>
          ))}
        </select>
        <span className="text-xs text-retro-cyan self-center">
          {filteredLogs.length} logs
        </span>
      </div>

      <div className="overflow-y-auto flex-1 text-xs font-mono p-2" style={{ fontSize: '10px' }}>
        {filteredLogs.length === 0 ? (
          <div className="text-retro-cyan">No logs</div>
        ) : (
          filteredLogs.slice(-50).reverse().map((log: LogEntry, idx: number) => {
            const time = new Date(log.timestamp).toLocaleTimeString()
            const levelColor: Record<string, string> = {
              info: '#00ff00',
              warn: '#ffff00',
              error: '#ff0000',
              debug: '#00ffff'
            }
            const color = levelColor[log.level] || '#ffffff'
            
            return (
              <div key={idx} className="mb-1 border-b border-gray-800 pb-1">
                <div>
                  <span style={{ color }}>[{log.level.toUpperCase()}]</span>
                  <span className="text-retro-cyan"> [{log.component}]</span>
                  <span className="text-gray-500"> {time}</span>
                </div>
                <div className="text-retro-green">{log.message}</div>
                {log.data && (
                  <details className="mt-1">
                    <summary className="text-retro-yellow cursor-pointer">Data</summary>
                    <pre className="text-xs mt-1 overflow-x-auto text-retro-cyan">
                      {JSON.stringify(log.data, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

