'use client'

import { useState, useEffect, useRef } from 'react'
import { useWallet } from '@/contexts/WalletContext'
import { getAllPendingGames, createGame, cancelGame, cancelExpiredGame, joinGame, getGame, Game } from '@/lib/contract'
import { ethers } from 'ethers'
import { io, Socket } from 'socket.io-client'
import { logger, logSocketEvent, logTransaction } from '@/lib/logger'

interface LobbyProps {
  onJoinGame: (gameId: number) => void
  onCreateGame: (gameId?: number) => void
  onPracticeMode: () => void
}

export default function Lobby({ onJoinGame, onCreateGame, onPracticeMode }: LobbyProps) {
  const { account, provider, signer, isConnected, isCorrectNetwork } = useWallet()
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [wager, setWager] = useState('0.01')
  const [difficulty, setDifficulty] = useState(5)
  const [expirationHours, setExpirationHours] = useState(24)
  const [creating, setCreating] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [gameToCancel, setGameToCancel] = useState<number | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<number | null>(null)
  const [showJoinConfirm, setShowJoinConfirm] = useState(false)
  const [gameToJoin, setGameToJoin] = useState<Game | null>(null)
  const [joining, setJoining] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (provider) {
      loadGames()
      
      // Connect to Socket.io for real-time updates
      const gameServerUrl = process.env.NEXT_PUBLIC_GAME_SERVER_URL || 'http://localhost:3001'
      const socket = io(gameServerUrl)
      socketRef.current = socket

      socket.on('game-created', () => {
        logSocketEvent('game-created', {}, 'received')
        logger.info('Lobby', 'New game created - refreshing lobby')
        loadGames()
      })

      socket.on('game-joined', (data: { gameId: number }) => {
        logSocketEvent('game-joined', data, 'received')
        logger.info('Lobby', 'Game joined event received', data)
        loadGames()
      })

      socket.on('game-cancelled', (data: { gameId: number }) => {
        logSocketEvent('game-cancelled', data, 'received')
        logger.info('Lobby', 'Game cancelled event received', data)
        loadGames()
      })

      return () => {
        socket.disconnect()
      }
    }
  }, [provider])

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadGames = async () => {
    if (!provider) return
    try {
      const pendingGames = await getAllPendingGames(provider)
      
      // Debug: log game data to check structure
      if (pendingGames.length > 0) {
        console.log('Sample game data:', pendingGames[0])
        console.log('Difficulty value:', pendingGames[0].difficulty, 'Type:', typeof pendingGames[0].difficulty)
      }
      
      // Check for expired games and auto-cancel them
      const now = Math.floor(Date.now() / 1000)
      for (const game of pendingGames) {
        if (game.expiresAt && Number(game.expiresAt) <= now) {
          // Game expired, try to cancel it
          if (signer) {
            try {
              await cancelExpiredGame(signer, Number(game.gameId))
            } catch (error) {
              console.error('Error auto-cancelling expired game:', error)
            }
          }
        }
      }
      
      // Reload games after potential cancellations
      const updatedGames = await getAllPendingGames(provider)
      setGames(updatedGames)
      setLoading(false)
    } catch (error) {
      console.error('Error loading games:', error)
      setLoading(false)
    }
  }

  const handleCreateGame = async () => {
    if (!signer || !isConnected) {
      alert('Please connect your wallet first')
      return
    }

    // Validate inputs
    if (!wager || parseFloat(wager) <= 0) {
      alert('Please enter a valid wager amount')
      return
    }

    if (difficulty < 1 || difficulty > 10) {
      alert('Difficulty must be between 1 and 10')
      return
    }

    if (expirationHours < 1 || expirationHours > 168) {
      alert('Expiration must be between 1 hour and 7 days (168 hours)')
      return
    }

    try {
      setCreating(true)
      logger.info('Lobby', 'Creating game', {
        difficulty,
        wager,
        expirationHours
      })
      const expirationSeconds = expirationHours * 60 * 60
      const result = await createGame(signer, difficulty, wager, expirationSeconds)
      logger.info('Lobby', 'Game created successfully', {
        txHash: result.tx.hash,
        gameId: result.gameId
      })
      setShowCreateModal(false)
      // Emit socket event for real-time update
      if (socketRef.current) {
        socketRef.current.emit('game-created')
      }
      
      // Wait a moment for blockchain state to sync
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // If we have the gameId, navigate to it, otherwise reload games
      if (result.gameId !== null) {
        logger.info('Lobby', 'Navigating to created game', { gameId: result.gameId })
        // Wait a bit more and then navigate
        await new Promise(resolve => setTimeout(resolve, 1000))
        onCreateGame(result.gameId)
      } else {
        // Fallback: reload games and let user navigate manually
        await loadGames()
      }
    } catch (error: any) {
      logger.error('Lobby', 'Error creating game', error)
      console.error('Error creating game:', error)
      
      // Provide more specific error messages
      let errorMessage = 'Failed to create game'
      if (error?.message) {
        errorMessage = error.message
        // Handle common error cases
        if (error.message.includes('user rejected')) {
          errorMessage = 'Transaction was cancelled'
        } else if (error.message.includes('insufficient funds')) {
          errorMessage = 'Insufficient funds in your wallet'
        } else if (error.message.includes('network')) {
          errorMessage = 'Network error. Please check your connection and try again'
        }
      }
      alert(errorMessage)
    } finally {
      setCreating(false)
    }
  }

  const handleCancelClick = (gameId: number) => {
    setGameToCancel(gameId)
    setShowCancelConfirm(true)
    setOpenDropdown(null)
  }

  const handleConfirmCancel = async () => {
    if (!signer || !gameToCancel) return

    try {
      setCancelling(true)
      await cancelGame(signer, gameToCancel)
      setShowCancelConfirm(false)
      // Emit socket event for real-time update
      if (socketRef.current) {
        socketRef.current.emit('game-cancelled', { gameId: gameToCancel })
      }
      setGameToCancel(null)
      await loadGames()
    } catch (error: any) {
      console.error('Error cancelling game:', error)
      alert(error.message || 'Failed to cancel game')
    } finally {
      setCancelling(false)
    }
  }

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  const formatEther = (value: bigint) => {
    return ethers.formatEther(value)
  }

  const formatTimeRemaining = (expiresAt: bigint) => {
    const now = Math.floor(Date.now() / 1000)
    const expires = Number(expiresAt)
    const remaining = expires - now

    if (remaining <= 0) {
      return 'EXPIRED'
    }

    const hours = Math.floor(remaining / 3600)
    const minutes = Math.floor((remaining % 3600) / 60)

    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  const isExpired = (expiresAt: bigint) => {
    const now = Math.floor(Date.now() / 1000)
    return Number(expiresAt) <= now
  }

  if (!isConnected) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <h2 className="text-3xl mb-4">CONNECT YOUR WALLET TO PLAY</h2>
        <p className="text-retro-cyan">Please connect your wallet to view and create games</p>
      </div>
    )
  }

  if (!isCorrectNetwork) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <h2 className="text-3xl mb-4 text-retro-yellow">SWITCH TO BASE SEPOLIA</h2>
        <p className="text-retro-cyan mb-2">
          Your wallet is connected, but it&apos;s on the wrong network.
        </p>
        <p className="text-retro-cyan">
          Please switch to the Base Sepolia testnet in your wallet to create or join games.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl">GAME LOBBY</h2>
        <div className="flex gap-4">
          <button
            onClick={onPracticeMode}
            className="pixel-button"
            title="Test game mechanics without blockchain"
          >
            PRACTICE MODE
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="pixel-button"
          >
            CREATE GAME
          </button>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-retro-bg pixel-border p-8 max-w-md w-full">
            <h3 className="text-2xl mb-4">CREATE GAME</h3>
            <div className="space-y-4">
              <div>
                <label className="block mb-2">Wager Amount (ETH)</label>
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={wager}
                  onChange={(e) => setWager(e.target.value)}
                  className="w-full bg-retro-bg pixel-border p-2 text-retro-green"
                />
              </div>
              <div>
                <label className="block mb-2">Difficulty: {difficulty}/10</label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={difficulty}
                  onChange={(e) => setDifficulty(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block mb-2">Game Expires In: {expirationHours} hours</label>
                <input
                  type="range"
                  min="1"
                  max="168"
                  value={expirationHours}
                  onChange={(e) => setExpirationHours(Number(e.target.value))}
                  className="w-full"
                />
                <div className="text-xs text-retro-cyan mt-1">
                  Range: 1 hour - 7 days (168 hours)
                </div>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={handleCreateGame}
                  disabled={creating}
                  className="pixel-button flex-1"
                >
                  {creating ? 'CREATING...' : 'CREATE'}
                </button>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="pixel-button flex-1"
                >
                  CANCEL
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-retro-bg pixel-border p-8 max-w-md w-full">
            <h3 className="text-2xl mb-4">CANCEL GAME?</h3>
            <p className="mb-6 text-retro-cyan">
              Are you sure you want to cancel your game? All wagered ETH will be returned to your wallet.
            </p>
            <div className="flex gap-4">
              <button
                onClick={handleConfirmCancel}
                disabled={cancelling}
                className="pixel-button flex-1"
              >
                {cancelling ? 'CANCELLING...' : 'YES'}
              </button>
              <button
                onClick={() => {
                  setShowCancelConfirm(false)
                  setGameToCancel(null)
                }}
                className="pixel-button flex-1"
              >
                NO
              </button>
            </div>
          </div>
        </div>
      )}

      {showJoinConfirm && gameToJoin && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-retro-bg pixel-border p-8 max-w-md w-full">
            <h3 className="text-2xl mb-4">JOIN GAME?</h3>
            <p className="mb-6 text-retro-cyan">
              Are you sure you want to match the <span className="text-retro-yellow font-bold">{formatEther(gameToJoin.wager)} ETH</span> wager?
            </p>
            <p className="mb-6 text-sm text-retro-cyan">
              You will need to approve the transaction in your wallet to deposit your wager.
            </p>
            <div className="flex gap-4">
              <button
                onClick={async () => {
                  if (!signer || !gameToJoin || !provider) return
                  try {
                    setJoining(true)
                    const gameId = Number(gameToJoin.gameId)
                    
                    // Refresh game list and verify game is still available before joining
                    await loadGames()
                    
                    // Get the latest game state from the blockchain
                    const currentGame = await getGame(provider, gameId)
                    
                    // Convert status to number for comparison (it might be bigint from contract)
                    const status = Number(currentGame.status)
                    logger.info('Lobby', 'Final game state check before joining', {
                      gameId,
                      status,
                      statusType: typeof currentGame.status,
                      isPending: status === 0
                    })
                    
                    // Check if game still exists and is available (0 = Pending)
                    if (status !== 0) {
                      const statusMessages: { [key: number]: string } = {
                        1: 'This game has already been joined by another player.',
                        2: 'This game has already been completed.',
                        3: 'This game has been cancelled.'
                      }
                      const message = statusMessages[status] || 'This game is no longer available.'
                      logger.warn('Lobby', 'Cannot join - game not pending', { gameId, status })
                      alert(message)
                      setShowJoinConfirm(false)
                      setGameToJoin(null)
                      return
                    }
                    
                    // Check if game has expired
                    const now = Math.floor(Date.now() / 1000)
                    if (currentGame.expiresAt && Number(currentGame.expiresAt) <= now) {
                      alert('This game has expired and is no longer available.')
                      setShowJoinConfirm(false)
                      setGameToJoin(null)
                      await loadGames() // Refresh to show updated state
                      return
                    }
                    
                    // Verify wager still matches
                    if (currentGame.wager !== gameToJoin.wager) {
                      alert('The wager amount for this game has changed. Please refresh and try again.')
                      setShowJoinConfirm(false)
                      setGameToJoin(null)
                      await loadGames()
                      return
                    }
                    
                    // Verify user is not trying to join their own game
                    if (currentGame.host.toLowerCase() === account?.toLowerCase()) {
                      alert('You cannot join your own game.')
                      setShowJoinConfirm(false)
                      setGameToJoin(null)
                      return
                    }
                    
                    // All checks passed, proceed with joining
                    logger.info('Lobby', 'All validation checks passed - joining game', {
                      gameId,
                      account,
                      host: currentGame.host,
                      wager: ethers.formatEther(currentGame.wager)
                    })
                    
                    const wagerAmount = ethers.formatEther(currentGame.wager)
                    const tx = await joinGame(signer, gameId, wagerAmount)
                    logTransaction('joinGame', tx.hash, gameId)
                    logger.info('Lobby', 'Join game transaction sent', {
                      gameId,
                      txHash: tx.hash
                    })
                    
                    // Wait for transaction to be confirmed (tx.wait() already called in joinGame, but wait a bit more for state sync)
                    logger.info('Lobby', 'Waiting for blockchain state to update', { gameId })
                    await new Promise(resolve => setTimeout(resolve, 2000)) // Wait 2 seconds for state to sync
                    
                    // Verify the game is now active before navigating
                    let retries = 3
                    let gameLoaded = false
                    while (retries > 0 && !gameLoaded) {
                      try {
                        const updatedGame = await getGame(provider, gameId)
                        const updatedStatus = Number(updatedGame.status)
                        logger.info('Lobby', 'Checking game status after join', {
                          gameId,
                          status: updatedStatus,
                          retriesLeft: retries
                        })
                        
                        if (updatedStatus === 1) { // Active
                          logger.info('Lobby', 'Game is now Active - safe to navigate', { gameId })
                          gameLoaded = true
                        } else if (updatedStatus === 0) {
                          // Still pending, wait a bit more
                          logger.warn('Lobby', 'Game still pending, waiting...', { gameId, retriesLeft: retries })
                          await new Promise(resolve => setTimeout(resolve, 1000))
                          retries--
                        } else {
                          // Game cancelled or completed - shouldn't happen
                          logger.error('Lobby', 'Unexpected game status after join', {
                            gameId,
                            status: updatedStatus
                          })
                          alert(`Game status is ${updatedStatus}. The game may have been cancelled.`)
                          setShowJoinConfirm(false)
                          setGameToJoin(null)
                          await loadGames()
                          return
                        }
                      } catch (error: any) {
                        logger.error('Lobby', 'Error verifying game after join', error)
                        retries--
                        if (retries > 0) {
                          await new Promise(resolve => setTimeout(resolve, 1000))
                        }
                      }
                    }
                    
                    if (!gameLoaded) {
                      logger.error('Lobby', 'Failed to verify game after join', { gameId })
                      alert('Game joined but could not verify status. Please refresh and try joining the game again.')
                      setShowJoinConfirm(false)
                      setGameToJoin(null)
                      await loadGames()
                      return
                    }
                    
                    setShowJoinConfirm(false)
                    // Emit socket event for real-time update and host notification
                    if (socketRef.current) {
                      const socketData = { 
                        gameId,
                        host: currentGame.host,
                        player: account
                      }
                      logSocketEvent('game-joined', socketData, 'sent')
                      logger.info('Lobby', 'Emitting game-joined socket event', socketData)
                      socketRef.current.emit('game-joined', socketData)
                    }
                    // Navigate to game now that we've verified it's active
                    // Add a small delay to ensure blockchain state is fully synced
                    logger.info('Lobby', 'Navigating to game', { 
                      gameId,
                      gameIdType: typeof gameId,
                      gameIdValue: gameId
                    })
                    await new Promise(resolve => setTimeout(resolve, 2000)) // Increased delay for state sync
                    
                    // Double-check game exists before navigating
                    try {
                      const finalCheck = await getGame(provider, gameId)
                      logger.info('Lobby', 'Final check before navigation', {
                        gameId,
                        status: Number(finalCheck.status),
                        host: finalCheck.host,
                        player: finalCheck.player
                      })
                    } catch (error) {
                      logger.error('Lobby', 'Game not found in final check before navigation', {
                        gameId,
                        error: error
                      })
                      alert('Game not found. Please try refreshing the page.')
                      setShowJoinConfirm(false)
                      setGameToJoin(null)
                      await loadGames()
                      return
                    }
                    
                    onJoinGame(gameId)
                    setGameToJoin(null)
                  } catch (error: any) {
                    console.error('Error joining game:', error)
                    // Parse error message to provide more helpful feedback
                    let errorMessage = 'Failed to join game. Please try again.'
                    if (error.message) {
                      if (error.message.includes('Game not available')) {
                        errorMessage = 'This game is no longer available. It may have been joined by another player, cancelled, or expired.'
                      } else if (error.message.includes('Wager must match')) {
                        errorMessage = 'The wager amount does not match. Please refresh and try again.'
                      } else if (error.message.includes('Cannot join your own game')) {
                        errorMessage = 'You cannot join your own game.'
                      } else if (error.message.includes('Game has expired')) {
                        errorMessage = 'This game has expired and is no longer available.'
                      } else {
                        errorMessage = error.message
                      }
                    }
                    alert(errorMessage)
                    // Refresh games list to show updated state
                    await loadGames()
                  } finally {
                    setJoining(false)
                  }
                }}
                disabled={joining || !signer}
                className="pixel-button flex-1"
              >
                {joining ? 'JOINING...' : 'YES'}
              </button>
              <button
                onClick={() => {
                  setShowJoinConfirm(false)
                  setGameToJoin(null)
                }}
                disabled={joining}
                className="pixel-button flex-1"
              >
                NO
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-20">
          <p className="text-retro-cyan">LOADING GAMES...</p>
        </div>
      ) : games.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-retro-cyan text-xl">NO GAMES AVAILABLE</p>
          <p className="mt-2">Be the first to create a game!</p>
        </div>
      ) : (
        <div className="space-y-4 retro-scrollbar max-h-[600px] overflow-y-auto">
          {games.map((game) => {
            const isMyGame = game.host.toLowerCase() === account?.toLowerCase()
            const expired = game.expiresAt ? isExpired(game.expiresAt) : false

            return (
              <div
                key={Number(game.gameId)}
                className={`pixel-border p-4 bg-retro-bg hover:bg-opacity-80 transition ${
                  expired ? 'opacity-60' : ''
                }`}
              >
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <div className="flex gap-4 mb-2 flex-wrap">
                      <span className="text-retro-cyan">
                        Game #{Number(game.gameId)}
                      </span>
                      <span className="text-retro-yellow">
                        Difficulty: {Number(game.difficulty) || 0}/10
                      </span>
                      <span className="text-retro-green">
                        Wager: {formatEther(game.wager)} ETH
                      </span>
                      {game.expiresAt && (
                        <span className={expired ? 'text-retro-red' : 'text-retro-cyan'}>
                          {expired ? 'EXPIRED' : `Expires: ${formatTimeRemaining(game.expiresAt)}`}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-retro-cyan">
                      Host: {formatAddress(game.host)}
                    </div>
                  </div>
                  <div className="relative ml-4" ref={isMyGame ? dropdownRef : null}>
                    {isMyGame ? (
                      <>
                        <button
                          onClick={() => setOpenDropdown(openDropdown === Number(game.gameId) ? null : Number(game.gameId))}
                          className="pixel-button"
                        >
                          YOUR GAME
                        </button>
                        {openDropdown === Number(game.gameId) && (
                          <div className="absolute right-0 mt-2 bg-retro-bg pixel-border z-10 min-w-[150px]">
                            <button
                              onClick={() => handleCancelClick(Number(game.gameId))}
                              className="w-full text-left px-4 py-2 hover:bg-retro-green hover:text-retro-bg transition"
                            >
                              CANCEL GAME
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <button
                        onClick={async () => {
                          // Refresh game state before showing join confirmation
                          if (provider) {
                            try {
                              await loadGames()
                              const gameId = Number(game.gameId)
                              logger.info('Lobby', 'Checking game state before join', { gameId })
                              const currentGame = await getGame(provider, gameId)
                              
                              // Convert status to number for comparison (it might be bigint from contract)
                              const status = Number(currentGame.status)
                              logger.info('Lobby', 'Game state check result', {
                                gameId,
                                status,
                                statusType: typeof currentGame.status,
                                isPending: status === 0
                              })
                              
                              // Check if game is still available (0 = Pending)
                              if (status !== 0) {
                                const statusMessages: { [key: number]: string } = {
                                  1: 'This game has already been joined by another player.',
                                  2: 'This game has already been completed.',
                                  3: 'This game has been cancelled.'
                                }
                                const message = statusMessages[status] || 'This game is no longer available. It may have been joined by another player or cancelled.'
                                logger.warn('Lobby', 'Game not available', { gameId, status })
                                alert(message)
                                await loadGames()
                                return
                              }
                              
                              // Check if expired
                              const now = Math.floor(Date.now() / 1000)
                              const expiresAt = Number(currentGame.expiresAt)
                              if (currentGame.expiresAt && expiresAt <= now) {
                                logger.warn('Lobby', 'Game expired', { gameId, expiresAt, now })
                                alert('This game has expired and is no longer available.')
                                await loadGames()
                                return
                              }
                              
                              logger.info('Lobby', 'Game is available - showing join confirmation', { gameId })
                              // Update gameToJoin with latest state
                              setGameToJoin(currentGame)
                              setShowJoinConfirm(true)
                            } catch (error: any) {
                              logger.error('Lobby', 'Error checking game state', error)
                              console.error('Error checking game state:', error)
                              // If there's an error, still allow them to try with the cached game data
                              // The blockchain call will fail if the game doesn't exist anyway
                              setGameToJoin(game)
                              setShowJoinConfirm(true)
                            }
                          } else {
                            setGameToJoin(game)
                            setShowJoinConfirm(true)
                          }
                        }}
                        disabled={expired}
                        className="pixel-button"
                      >
                        {expired ? 'EXPIRED' : 'JOIN'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
