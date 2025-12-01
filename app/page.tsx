'use client'

import { useState, useEffect, useRef } from 'react'
import { WalletProvider } from '@/contexts/WalletContext'
import Lobby from '@/components/Lobby'
import Game from '@/components/Game'
import Leaderboard from '@/components/Leaderboard'
import WalletConnect from '@/components/WalletConnect'

export default function Home() {
  const [currentView, setCurrentView] = useState<'lobby' | 'game' | 'leaderboard'>('lobby')
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

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

  return (
    <WalletProvider>
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
                              color: currentView === 'lobby' ? '#0a0a0a' : '#00ff00',
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
                              color: currentView === 'leaderboard' ? '#0a0a0a' : '#00ff00',
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
    </WalletProvider>
  )
}



