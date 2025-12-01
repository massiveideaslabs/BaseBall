'use client'

import { useState, useEffect } from 'react'
import { useWallet } from '@/contexts/WalletContext'
import { getPlayerStats, PlayerStats } from '@/lib/contract'
import { ethers } from 'ethers'

interface LeaderboardEntry {
  address: string
  wins: bigint
  totalWinnings: bigint
  gamesPlayed: bigint
}

export default function Leaderboard() {
  const { provider } = useWallet()
  const [topByWins, setTopByWins] = useState<LeaderboardEntry[]>([])
  const [topByWinnings, setTopByWinnings] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null)
  const [searchAddress, setSearchAddress] = useState('')

  useEffect(() => {
    // In a real implementation, you'd fetch leaderboard data from a backend
    // or use events to build the leaderboard. For now, we'll show a placeholder
    // and allow users to search for specific player stats
    setLoading(false)
  }, [])

  const handleSearch = async () => {
    if (!provider || !searchAddress) return
    try {
      const stats = await getPlayerStats(provider, searchAddress)
      setPlayerStats(stats)
    } catch (error) {
      console.error('Error fetching player stats:', error)
      alert('Failed to fetch player stats')
    }
  }

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  const formatEther = (value: bigint) => {
    return parseFloat(ethers.formatEther(value)).toFixed(4)
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h2 className="text-4xl mb-8 text-center">LEADERBOARD</h2>

      <div className="mb-8 pixel-border p-4">
        <h3 className="text-2xl mb-4">SEARCH PLAYER</h3>
        <div className="flex gap-4">
          <input
            type="text"
            value={searchAddress}
            onChange={(e) => setSearchAddress(e.target.value)}
            placeholder="Enter wallet address"
            className="flex-1 bg-retro-bg pixel-border p-2 text-retro-green"
          />
          <button onClick={handleSearch} className="pixel-button">
            SEARCH
          </button>
        </div>
        {playerStats && (
          <div className="mt-4 space-y-2">
            <p>Wins: {playerStats.wins.toString()}</p>
            <p>Total Winnings: {formatEther(playerStats.totalWinnings)} ETH</p>
            <p>Games Played: {playerStats.gamesPlayed.toString()}</p>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="pixel-border p-6">
          <h3 className="text-2xl mb-4 text-retro-yellow">TOP 20 BY WINS</h3>
          {loading ? (
            <p className="text-retro-cyan">Loading...</p>
          ) : topByWins.length === 0 ? (
            <div className="space-y-2">
              <p className="text-retro-cyan">Leaderboard data will appear here</p>
              <p className="text-sm text-retro-cyan opacity-75">
                Note: Full leaderboard requires indexing game events. 
                Use the search above to check individual player stats.
              </p>
            </div>
          ) : (
            <div className="space-y-2 retro-scrollbar max-h-[500px] overflow-y-auto">
              {topByWins.map((entry, index) => (
                <div
                  key={entry.address}
                  className="flex justify-between items-center p-2 bg-retro-bg pixel-border"
                >
                  <span className="text-retro-cyan">#{index + 1}</span>
                  <span>{formatAddress(entry.address)}</span>
                  <span className="text-retro-yellow">{entry.wins.toString()} wins</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pixel-border p-6">
          <h3 className="text-2xl mb-4 text-retro-yellow">TOP 20 BY WINNINGS</h3>
          {loading ? (
            <p className="text-retro-cyan">Loading...</p>
          ) : topByWinnings.length === 0 ? (
            <div className="space-y-2">
              <p className="text-retro-cyan">Leaderboard data will appear here</p>
              <p className="text-sm text-retro-cyan opacity-75">
                Note: Full leaderboard requires indexing game events. 
                Use the search above to check individual player stats.
              </p>
            </div>
          ) : (
            <div className="space-y-2 retro-scrollbar max-h-[500px] overflow-y-auto">
              {topByWinnings.map((entry, index) => (
                <div
                  key={entry.address}
                  className="flex justify-between items-center p-2 bg-retro-bg pixel-border"
                >
                  <span className="text-retro-cyan">#{index + 1}</span>
                  <span>{formatAddress(entry.address)}</span>
                  <span className="text-retro-green">{formatEther(entry.totalWinnings)} ETH</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}



