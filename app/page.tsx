'use client'

import { useState, useEffect, useRef } from 'react'
import { WalletProvider, useWallet } from '@/contexts/WalletContext'
import Lobby from '@/components/Lobby'
import Game from '@/components/Game'
import Leaderboard from '@/components/Leaderboard'
import WalletConnect from '@/components/WalletConnect'
import { io, Socket } from 'socket.io-client'

function HomeContent() {
  const { account } = useWallet()
  const [currentView, setCurrentView] = useState<'lobby' | 'game' | 'leaderboard'>('lobby')
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [showHostNotification, setShowHostNotification] = useState(false)
  const [hostNotificationGameId, setHostNotificationGameId] = useState<number | null>(null)
  const [hostNotificationTimer, setHostNotificationTimer] = useState(60)
  const menuRef = useRef<HTMLDivElement>(null)
  const socketRef = useRef<Socket | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMobileMenuOpen(false)
      }
    }

    if (isMobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isMobileMenuOpen])

  // Set up Socket.io for host notifications
  useEffect(() => {
    if (!account) return

    const gameServerUrl = process.env.NEXT_PUBLIC_GAME_SERVER_URL || 'http://localhost:3001'
    const socket = io(gameServerUrl)
    socketRef.current = socket

    socket.on('player-joined-game', (data: { gameId: number }) => {
      // Check if this user is the host of this game
      // We'll need to verify this in the server or check game data
      console.log('Player joined game:', data.gameId)
      setHostNotificationGameId(data.gameId)
      setShowHostNotification(true)
      setHostNotificationTimer(60)
      
      // Start countdown timer
      timerRef.current = setInterval(() => {
        setHostNotificationTimer((prev) => {
          if (prev <= 1) {
            // Time's up - cancel the game
            if (timerRef.current) {
              clearInterval(timerRef.current)
            }
            setShowHostNotification(false)
            setHostNotificationGameId(null)
            // TODO: Auto-cancel game if host doesn't join
            return 0
          }
          return prev - 1
        })
      }, 1000)
    })

    return () => {
      socket.disconnect()
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [account])

  const handleJoinAsHost = () => {
    if (hostNotificationGameId) {
      setSelectedGameId(hostNotificationGameId)
      setCurrentView('game')
      setShowHostNotification(false)
      setHostNotificationGameId(null)
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }

  return (
    <>
      {showHostNotification && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-retro-bg pixel-border p-8 max-w-md w-full">
            <h3 className="text-2xl mb-4 text-retro-yellow">SOMEONE JOINED YOUR GAME!</h3>
            <p className="mb-4 text-retro-cyan">
              A player has joined Game #{hostNotificationGameId} and matched your wager.
            </p>
            <p className="mb-6 text-retro-yellow text-xl">
              Join within {hostNotificationTimer} seconds or the game will be cancelled.
            </p>
            <div className="flex gap-4">
              <button
                onClick={handleJoinAsHost}
                className="pixel-button flex-1"
              >
                JOIN GAME NOW
              </button>
              <button
                onClick={() => {
                  setShowHostNotification(false)
                  setHostNotificationGameId(null)
                  if (timerRef.current) {
                    clearInterval(timerRef.current)
                  }
                }}
                className="pixel-button flex-1"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="min-h-screen flex flex-col">
        <header className="p-2 sm:p-4 border-b-4 border-retro-green relative">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <h1 className="text-2xl sm:text-4xl text-retro-green">BASE BALL</h1>
            {isMobile ? (
              <>
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="pixel-button text-lg sm:text-base p-2"
                  style={{ minWidth: 'auto' }}
                >
                  ☰
                </button>
                {isMobileMenuOpen && (
                  <>
                    <div 
                      className="fixed inset-0 bg-black bg-opacity-75 z-40"
                      onClick={() => setIsMobileMenuOpen(false)}
                      style={{ zIndex: 9998 }}
                    />
                    <div 
                      className="fixed top-0 right-0 h-full w-full max-w-sm pixel-border bg-retro-bg z-50 overflow-y-auto"
                      ref={menuRef}
                      style={{
                        backgroundColor: '#0a0a0a',
                        border: '4px solid #00ff00',
                        borderTop: 'none',
                        borderRight: 'none',
                        zIndex: 9999,
                      }}
                    >
                      <div className="p-4">
                        <div className="flex justify-between items-center mb-6">
                          <h2 className="text-xl text-retro-green">MENU</h2>
                          <button
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="pixel-button text-lg p-2"
                            style={{ minWidth: 'auto' }}
                          >
                            ✕
                          </button>
                        </div>
                        <div className="space-y-2">
                          <button
                            onClick={() => {
                              setCurrentView('lobby')
                              setIsMobileMenuOpen(false)
                            }}
                            className={`w-full text-left px-4 py-4 pixel-button transition ${
                              currentView === 'lobby' 
                                ? 'bg-retro-green' 
                                : ''
                            }`}
                            style={{
                              color: '#00ff00',
                            }}
                          >
                            LOBBY
                          </button>
                          <button
                            onClick={() => {
                              setCurrentView('leaderboard')
                              setIsMobileMenuOpen(false)
                            }}
                            className={`w-full text-left px-4 py-4 pixel-button transition ${
                              currentView === 'leaderboard' 
                                ? 'bg-retro-green' 
                                : ''
                            }`}
                            style={{
                              color: '#00ff00',
                            }}
                          >
                            LEADERBOARD
                          </button>
                          <div className="pt-4">
                            <WalletConnect />
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </>
            ) : (
              <nav className="flex gap-4">
                <button
                  onClick={() => setCurrentView('lobby')}
                  className={`pixel-button ${currentView === 'lobby' ? 'bg-retro-green text-retro-bg' : ''}`}
                >
                  LOBBY
                </button>
                <button
                  onClick={() => setCurrentView('leaderboard')}
                  className={`pixel-button ${currentView === 'leaderboard' ? 'bg-retro-green text-retro-bg' : ''}`}
                >
                  LEADERBOARD
                </button>
                <WalletConnect />
              </nav>
            )}
          </div>
        </header>

        <main className="flex-1 p-4">
          {currentView === 'lobby' && (
            <Lobby 
              onJoinGame={(gameId) => {
                setSelectedGameId(gameId)
                setCurrentView('game')
              }}
              onCreateGame={() => setCurrentView('game')}
              onPracticeMode={() => {
                setSelectedGameId(null)
                setCurrentView('game')
              }}
            />
          )}
          {currentView === 'game' && (
            <Game 
              gameId={selectedGameId}
              practiceMode={selectedGameId === null}
              onExit={() => {
                setSelectedGameId(null)
                setCurrentView('lobby')
              }}
            />
          )}
          {currentView === 'leaderboard' && <Leaderboard />}
        </main>

        <footer className="p-4 border-t-4 border-retro-green text-center text-sm">
          <p>Built on Base Chain | Play at your own risk</p>
        </footer>
      </div>
    </>
  )
}

export default function Home() {
  return (
    <WalletProvider>
      <HomeContent />
    </WalletProvider>
  )
}



