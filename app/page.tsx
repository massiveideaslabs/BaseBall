'use client'

import { useState, useEffect } from 'react'
import { WalletProvider } from '@/contexts/WalletContext'
import Lobby from '@/components/Lobby'
import Game from '@/components/Game'
import Leaderboard from '@/components/Leaderboard'
import WalletConnect from '@/components/WalletConnect'

export default function Home() {
  const [currentView, setCurrentView] = useState<'lobby' | 'game' | 'leaderboard'>('lobby')
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null)

  return (
    <WalletProvider>
      <div className="min-h-screen flex flex-col">
        <header className="p-4 border-b-4 border-retro-green">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <h1 className="text-4xl text-retro-green">BASE BALL</h1>
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



