'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useWallet } from '@/contexts/WalletContext'
import { getGame, joinGame, cancelGame, completeGame, Game as GameData } from '@/lib/contract'
import { ethers } from 'ethers'
import { logger, logGameState } from '@/lib/logger'

interface GameProps {
  gameId: number | null
  practiceMode?: boolean
  onExit: () => void
}

interface Ball {
  x: number
  y: number
  dx: number
  dy: number
  speed: number
}

interface Paddle {
  y: number
  height: number
}

const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 600
const PADDLE_WIDTH = 10
const PADDLE_HEIGHT = 100
const BALL_SIZE = 10
const PADDLE_SPEED = 5

export default function Game({ gameId, practiceMode = false, onExit }: GameProps) {
  const { account, provider, signer, isConnected } = useWallet()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameRef = useRef<number>()
  const [gameData, setGameData] = useState<GameData | null>(null)
  const [loading, setLoading] = useState(true)
  const [gameStarted, setGameStarted] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [winner, setWinner] = useState<string | null>(null)
  const [score, setScore] = useState({ left: 0, right: 0 })
  const scoreRef = useRef({ left: 0, right: 0 })
  const [touchCount, setTouchCount] = useState(0)
  const [completing, setCompleting] = useState(false)
  const [practiceDifficulty, setPracticeDifficulty] = useState(5)
  const scoredThisFrame = useRef(false)

  const leftPaddleRef = useRef<Paddle>({ y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2, height: PADDLE_HEIGHT })
  const rightPaddleRef = useRef<Paddle>({ y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2, height: PADDLE_HEIGHT })
  const ballRef = useRef<Ball>({
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT / 2,
    dx: 0,
    dy: 0,
    speed: 0,
  })

  const mouseYRef = useRef<number>(CANVAS_HEIGHT / 2)
  const keysRef = useRef<{ up: boolean; down: boolean }>({ up: false, down: false })

  const loadGame = useCallback(async () => {
    if (!gameId || !provider) {
      logger.warn('Game', 'Cannot load game - missing gameId or provider', { gameId, hasProvider: !!provider })
      setLoading(false)
      return
    }
    
    try {
      // Retry logic to handle blockchain state sync delays
      let retries = 5
      let data: GameData | null = null
      
      while (retries > 0 && !data) {
        try {
          logger.info('Game', 'Fetching game data from blockchain', { 
            gameId, 
            account,
            retriesLeft: retries 
          })
          data = await getGame(provider, gameId)
        logger.info('Game', 'Game data received', { 
          gameId,
          status: Number(data.status),
          host: data.host,
          player: data.player,
          wager: data.wager?.toString(),
          difficulty: Number(data.difficulty)
        })
          break // Success, exit retry loop
        } catch (error: any) {
          logger.error('Game', 'Error loading game', error)
          const errorMessage = error?.message || error?.toString() || 'Unknown error'
          logger.error('Game', 'Error details', {
            gameId,
            errorMessage,
            errorType: error?.constructor?.name,
            retriesLeft: retries
          })
          
          retries--
          if (retries > 0) {
            // Wait before retrying (exponential backoff)
            const waitTime = (6 - retries) * 500 // 500ms, 1000ms, 1500ms, 2000ms
            logger.info('Game', `Retrying in ${waitTime}ms...`, { gameId, retriesLeft: retries })
            await new Promise(resolve => setTimeout(resolve, waitTime))
          }
        }
      }
      
      if (!data) {
        // All retries failed
        logger.error('Game', 'Failed to load game after all retries', { gameId })
        setGameData(null)
        setLoading(false)
        return
      }
      
      // Convert status to number for comparison
      const status = Number(data.status)
      logGameState(gameId, status, account, data)
      
      setGameData(data)
      setLoading(false)

      // If game is active (status === 1) and player is part of it, check if both players are ready
      if (status === 1) {
        const isHost = data.host.toLowerCase() === account?.toLowerCase()
        const isPlayer = data.player && data.player.toLowerCase() === account?.toLowerCase()
        const playerAddress = data.player ? data.player.toLowerCase() : ''
        const accountAddress = account?.toLowerCase() || ''
        const hasPlayer = data.player && data.player !== '0x0000000000000000000000000000000000000000'
        
        logger.info('Game', 'Game is Active - checking player participation', {
          gameId,
          status: status,
          host: data.host.toLowerCase(),
          player: playerAddress,
          account: accountAddress,
          isHost,
          isPlayer,
          hasPlayer
        })
        
        if (isHost || isPlayer) {
          // Both players must be present (hasPlayer = true) before starting
          if (hasPlayer) {
            // Both players are present - start the game
            logger.info('Game', 'Both players present - initializing game', {
              gameId,
              difficulty: data.difficulty,
              role: isHost ? 'host' : 'player'
            })
            initializeGame(data.difficulty)
          } else {
            // Player hasn't joined yet - show waiting message
            logger.info('Game', 'Waiting for other player to join', { 
              gameId,
              role: isHost ? 'host' : 'player'
            })
            // Don't initialize game yet, will show waiting message in render
          }
        } else {
          logger.warn('Game', 'Game is active but current account is not host or player', {
            gameId,
            account,
            host: data.host,
            player: data.player
          })
          // If game is active but we're not in it, show waiting message
        }
      } else if (status === 0) {
        logger.info('Game', 'Game is still pending', { gameId, status: status })
        // Game is still pending, will be handled by the status === 0 check below
      } else {
        logger.warn('Game', 'Unknown game status', { gameId, status: status })
      }
    } catch (error: any) {
      // Catch any unexpected errors
      logger.error('Game', 'Unexpected error in loadGame', error)
      setGameData(null)
      setLoading(false)
    }
  }, [gameId, provider, account])

  useEffect(() => {
    logger.info('Game', 'Component mounted/updated', {
      gameId,
      practiceMode,
      hasProvider: !!provider,
      account
    })
    
    if (practiceMode) {
      // Practice mode - skip blockchain, just show difficulty selector
      logger.info('Game', 'Practice mode enabled')
      setLoading(false)
    } else if (gameId && provider) {
      logger.info('Game', 'Loading game from blockchain', { gameId })
      loadGame()
      
      // Set a timeout to ensure loading doesn't stay true forever
      const loadingTimeout = setTimeout(() => {
        if (loading) {
          logger.warn('Game', 'Loading timeout - forcing loading to false', { gameId })
          setLoading(false)
        }
      }, 30000) // 30 second timeout
      
      return () => clearTimeout(loadingTimeout)
    } else if (!gameId && !practiceMode) {
      // No game ID and not practice mode - show error
      logger.warn('Game', 'No gameId provided and not practice mode')
      setLoading(false)
    }
  }, [gameId, provider, account, practiceMode])

  // Poll game state when waiting for other player
  useEffect(() => {
    if (!gameId || !provider || practiceMode || gameStarted) return
    
    // Set up polling to check game state periodically when waiting for other player
    const pollInterval = setInterval(async () => {
      if (gameId && provider && !gameStarted) {
        try {
          const updatedGame = await getGame(provider, gameId)
          const updatedStatus = Number(updatedGame.status)
          const hasPlayer = updatedGame.player && updatedGame.player !== '0x0000000000000000000000000000000000000000'
          
          logger.info('Game', 'Polling game state', {
            gameId,
            status: updatedStatus,
            hasPlayer,
            gameStarted,
            hasGameData: !!gameData,
            loading
          })
          
          // If both players are now present and game hasn't started, reload game
          if (updatedStatus === 1 && hasPlayer && !gameStarted) {
            logger.info('Game', 'Both players detected - reloading game', { gameId })
            loadGame()
          } else if (!gameData && updatedStatus === 1) {
            // Game is active but we don't have game data yet - reload
            logger.info('Game', 'Game active but no data - reloading', { gameId })
            loadGame()
          }
        } catch (error) {
          logger.error('Game', 'Error polling game state', error)
        }
      }
    }, 2000) // Poll every 2 seconds
    
    return () => clearInterval(pollInterval)
  }, [gameId, provider, practiceMode, gameData, gameStarted, loadGame, loading])

  useEffect(() => {
    if (gameStarted && !gameOver) {
      const canvas = canvasRef.current
      if (!canvas) return

      const handleMouseMove = (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect()
        mouseYRef.current = e.clientY - rect.top
      }

      const handleTouchMove = (e: TouchEvent) => {
        e.preventDefault()
        const rect = canvas.getBoundingClientRect()
        const touch = e.touches[0]
        if (touch) {
          mouseYRef.current = touch.clientY - rect.top
        }
      }

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'ArrowUp') keysRef.current.up = true
        if (e.key === 'ArrowDown') keysRef.current.down = true
      }

      const handleKeyUp = (e: KeyboardEvent) => {
        if (e.key === 'ArrowUp') keysRef.current.up = false
        if (e.key === 'ArrowDown') keysRef.current.down = false
      }

      canvas.addEventListener('mousemove', handleMouseMove)
      canvas.addEventListener('touchmove', handleTouchMove, { passive: false })
      canvas.addEventListener('touchstart', handleTouchMove, { passive: false })
      window.addEventListener('keydown', handleKeyDown)
      window.addEventListener('keyup', handleKeyUp)

      return () => {
        canvas.removeEventListener('mousemove', handleMouseMove)
        canvas.removeEventListener('touchmove', handleTouchMove)
        canvas.removeEventListener('touchstart', handleTouchMove)
        window.removeEventListener('keydown', handleKeyDown)
        window.removeEventListener('keyup', handleKeyUp)
      }
    }
  }, [gameStarted, gameOver])

  useEffect(() => {
    if (gameStarted && !gameOver) {
      gameLoop()
      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
        }
      }
    }
  }, [gameStarted, gameOver])

  const initializeGame = (difficulty: number) => {
    // Base speed increases with difficulty (1-10)
    const baseSpeed = 2 + (difficulty * 0.5)
    const angle = (Math.random() * Math.PI / 3) - Math.PI / 6 // -30 to 30 degrees
    ballRef.current = {
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT / 2,
      dx: Math.cos(angle) * baseSpeed,
      dy: Math.sin(angle) * baseSpeed,
      speed: baseSpeed,
    }
    setGameStarted(true)
  }

  const handleJoinGame = async () => {
    if (!gameId || !signer || !gameData) return
    try {
      await joinGame(signer, gameId, ethers.formatEther(gameData.wager))
      // Wait a moment for blockchain to update
      await new Promise(resolve => setTimeout(resolve, 1000))
      // Reload game data to get updated status
      await loadGame()
    } catch (error: any) {
      alert(error.message || 'Failed to join game')
    }
  }

  const handleCancelGame = async () => {
    if (!gameId || !signer) return
    try {
      await cancelGame(signer, gameId)
      alert('Game cancelled. Your wager has been refunded.')
      onExit()
    } catch (error: any) {
      alert(error.message || 'Failed to cancel game')
    }
  }

  const handleCompleteGame = async (winnerAddress: string | 'left' | 'right') => {
    if (practiceMode) {
      // Practice mode - just end the game, no blockchain
      setGameOver(true)
      setWinner(winnerAddress === 'left' ? 'You' : 'AI Opponent')
      return
    }
    
    if (!gameId || !signer || completing || gameOver || typeof winnerAddress !== 'string') return
    
    setCompleting(true)
    setGameOver(true) // Stop the game immediately
    
    try {
      await completeGame(signer, gameId, winnerAddress)
      setWinner(winnerAddress)
    } catch (error: any) {
      console.error('Error completing game:', error)
      alert(error.message || 'Failed to complete game. Please try again.')
      // Reset game state if completion failed
      setGameOver(false)
      setCompleting(false)
    }
  }

  const updatePaddles = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Left paddle (mouse/keyboard control)
    const targetY = mouseYRef.current - PADDLE_HEIGHT / 2
    if (keysRef.current.up) {
      leftPaddleRef.current.y = Math.max(0, leftPaddleRef.current.y - PADDLE_SPEED)
    } else if (keysRef.current.down) {
      leftPaddleRef.current.y = Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, leftPaddleRef.current.y + PADDLE_SPEED)
    } else {
      leftPaddleRef.current.y = Math.max(0, Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, targetY))
    }

    // Right paddle (AI for now - in multiplayer, this would be controlled by opponent)
    const ball = ballRef.current
    const rightPaddle = rightPaddleRef.current
    const paddleCenter = rightPaddle.y + PADDLE_HEIGHT / 2
    if (ball.y < paddleCenter - 10) {
      rightPaddle.y = Math.max(0, rightPaddle.y - PADDLE_SPEED)
    } else if (ball.y > paddleCenter + 10) {
      rightPaddle.y = Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, rightPaddle.y + PADDLE_SPEED)
    }
  }

  const updateBall = () => {
    const ball = ballRef.current
    const leftPaddle = leftPaddleRef.current
    const rightPaddle = rightPaddleRef.current

    // Reset scored flag at start of frame
    if (scoredThisFrame.current && (ball.x >= 0 && ball.x <= CANVAS_WIDTH)) {
      scoredThisFrame.current = false
    }

    // Move ball
    ball.x += ball.dx
    ball.y += ball.dy

    // Ball collision with top/bottom walls
    if (ball.y <= BALL_SIZE / 2 || ball.y >= CANVAS_HEIGHT - BALL_SIZE / 2) {
      ball.dy = -ball.dy
    }

    // Ball collision with left paddle
    if (
      ball.x - BALL_SIZE / 2 <= PADDLE_WIDTH &&
      ball.y >= leftPaddle.y &&
      ball.y <= leftPaddle.y + PADDLE_HEIGHT &&
      ball.dx < 0
    ) {
      ball.dx = -ball.dx
      const hitPos = (ball.y - leftPaddle.y) / PADDLE_HEIGHT
      ball.dy = (hitPos - 0.5) * ball.speed * 2
      increaseBallSpeed()
    }

    // Ball collision with right paddle
    if (
      ball.x + BALL_SIZE / 2 >= CANVAS_WIDTH - PADDLE_WIDTH &&
      ball.y >= rightPaddle.y &&
      ball.y <= rightPaddle.y + PADDLE_HEIGHT &&
      ball.dx > 0
    ) {
      ball.dx = -ball.dx
      const hitPos = (ball.y - rightPaddle.y) / PADDLE_HEIGHT
      ball.dy = (hitPos - 0.5) * ball.speed * 2
      increaseBallSpeed()
    }

    // Score points - only process if game is still active and haven't scored this frame
    if (!gameOver && !completing && !scoredThisFrame.current) {
      if (ball.x < -BALL_SIZE) {
        // Right player scores - ball went past left edge
        scoredThisFrame.current = true
        setScore((prev) => {
          const newRightScore = prev.right + 1
          console.log('Right player scored! New score:', newRightScore)
          
          // Check for game over
          if (newRightScore >= 10) {
            // Stop ball movement immediately
            ball.dx = 0
            ball.dy = 0
            // Complete game automatically
            setTimeout(() => {
              if (practiceMode) {
                handleCompleteGame('right')
              } else if (gameData && gameData.player) {
                handleCompleteGame(gameData.player)
              }
            }, 100)
          } else {
            // Stop ball movement
            ball.dx = 0
            ball.dy = 0
            // Reset ball for next point
            setTimeout(() => {
              if (!gameOver && !completing) {
                resetBall()
              }
            }, 1000) // Delay to show the score
          }
          
          const newScore = { ...prev, right: newRightScore }
          scoreRef.current = newScore
          return newScore
        })
      } else if (ball.x > CANVAS_WIDTH + BALL_SIZE) {
        // Left player scores - ball went past right edge
        scoredThisFrame.current = true
        setScore((prev) => {
          const newLeftScore = prev.left + 1
          console.log('Left player scored! New score:', newLeftScore)
          
          // Check for game over
          if (newLeftScore >= 10) {
            // Stop ball movement immediately
            ball.dx = 0
            ball.dy = 0
            // Complete game automatically
            setTimeout(() => {
              if (practiceMode) {
                handleCompleteGame('left')
              } else if (gameData && gameData.host) {
                handleCompleteGame(gameData.host)
              }
            }, 100)
          } else {
            // Stop ball movement
            ball.dx = 0
            ball.dy = 0
            // Reset ball for next point
            setTimeout(() => {
              if (!gameOver && !completing) {
                resetBall()
              }
            }, 1000) // Delay to show the score
          }
          
          const newScore = { ...prev, left: newLeftScore }
          scoreRef.current = newScore
          return newScore
        })
      }
    }
  }

  const increaseBallSpeed = () => {
    setTouchCount((prev) => {
      const newCount = prev + 1
      if (newCount >= 10) {
        const difficulty = practiceMode ? practiceDifficulty : (gameData?.difficulty || 5)
        const speedIncrease = 0.2 + (difficulty * 0.05)
        ballRef.current.speed += speedIncrease
        const currentSpeed = Math.sqrt(ballRef.current.dx ** 2 + ballRef.current.dy ** 2)
        const ratio = ballRef.current.speed / currentSpeed
        ballRef.current.dx *= ratio
        ballRef.current.dy *= ratio
        return 0 // Reset counter
      }
      return newCount
    })
  }

  const resetBall = () => {
    const difficulty = practiceMode ? practiceDifficulty : (gameData?.difficulty || 5)
    const baseSpeed = 2 + (difficulty * 0.5)
    const angle = (Math.random() * Math.PI / 3) - Math.PI / 6
    ballRef.current = {
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT / 2,
      dx: Math.cos(angle) * baseSpeed,
      dy: Math.sin(angle) * baseSpeed,
      speed: baseSpeed,
    }
  }

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    // Draw center line
    ctx.strokeStyle = '#00ff00'
    ctx.setLineDash([10, 10])
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(CANVAS_WIDTH / 2, 0)
    ctx.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT)
    ctx.stroke()
    ctx.setLineDash([])

    // Draw paddles
    ctx.fillStyle = '#00ff00'
    ctx.fillRect(0, leftPaddleRef.current.y, PADDLE_WIDTH, PADDLE_HEIGHT)
    ctx.fillRect(CANVAS_WIDTH - PADDLE_WIDTH, rightPaddleRef.current.y, PADDLE_WIDTH, PADDLE_HEIGHT)

    // Draw ball
    ctx.fillStyle = '#00ffff'
    ctx.beginPath()
    ctx.arc(ballRef.current.x, ballRef.current.y, BALL_SIZE / 2, 0, Math.PI * 2)
    ctx.fill()

    // Draw score - use ref to get latest score value
    ctx.fillStyle = '#00ff00'
    ctx.font = '48px "Press Start 2P"'
    ctx.textAlign = 'center'
    ctx.fillText(scoreRef.current.left.toString(), CANVAS_WIDTH / 4, 60)
    ctx.fillText(scoreRef.current.right.toString(), (3 * CANVAS_WIDTH) / 4, 60)
  }, [])

  const gameLoop = useCallback(() => {
    if (!gameOver && !completing) {
      updatePaddles()
      updateBall()
    }
    draw()

    if (!gameOver && !completing) {
      animationFrameRef.current = requestAnimationFrame(gameLoop)
    }
  }, [gameOver, completing, draw])

  if (loading) {
    logger.debug('Game', 'Rendering loading state', { gameId, practiceMode })
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <p className="text-retro-cyan text-xl">LOADING GAME...</p>
        {gameId && <p className="text-sm text-retro-cyan mt-2 ml-2">Game ID: {gameId}</p>}
      </div>
    )
  }

  // Show error if gameId provided but no gameData loaded
  if (gameId && !practiceMode && !gameData) {
    logger.error('Game', 'Game data not loaded but gameId provided', { gameId, practiceMode })
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <p className="text-retro-yellow text-xl mb-4">GAME NOT FOUND</p>
        <p className="text-retro-cyan mb-4">Unable to load game #{gameId}</p>
        <button onClick={onExit} className="pixel-button">
          BACK TO LOBBY
        </button>
      </div>
    )
  }

  if (!gameData && gameId) {
    logger.error('Game', 'No game data available', { gameId })
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <p className="text-retro-red text-xl">GAME NOT FOUND</p>
      </div>
    )
  }

  if (gameData && gameData.status === 0 && gameData.host.toLowerCase() === account?.toLowerCase()) {
    logger.info('Game', 'Rendering: Host waiting for player', { gameId, account })
    return (
      <div className="max-w-4xl mx-auto">
        <div className="pixel-border p-8 text-center">
          <h2 className="text-3xl mb-4">WAITING FOR PLAYER</h2>
          <p className="mb-6">Your game is waiting for another player to join.</p>
          <div className="flex gap-4 justify-center">
            <button onClick={handleCancelGame} className="pixel-button">
              CANCEL GAME
            </button>
            <button onClick={onExit} className="pixel-button">
              BACK TO LOBBY
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (gameData && gameData.status === 0) {
    const isHost = gameData.host.toLowerCase() === account?.toLowerCase()
    const isPlayer = gameData.player && gameData.player.toLowerCase() === account?.toLowerCase()
    
    logger.info('Game', 'Rendering: Pending game state', {
      gameId,
      isHost,
      isPlayer,
      account,
      host: gameData.host,
      player: gameData.player
    })
    
    if (isHost) {
      // Host waiting for player
      return (
        <div className="max-w-4xl mx-auto">
          <div className="pixel-border p-8 text-center">
            <h2 className="text-3xl mb-4">WAITING FOR PLAYER</h2>
            <p className="mb-6">Your game is waiting for another player to join.</p>
            <div className="flex gap-4 justify-center">
              <button onClick={handleCancelGame} className="pixel-button">
                CANCEL GAME
              </button>
              <button onClick={onExit} className="pixel-button">
                BACK TO LOBBY
              </button>
            </div>
          </div>
        </div>
      )
    } else if (!isPlayer) {
      // Not the host and not joined yet - show join button
      return (
        <div className="max-w-4xl mx-auto">
          <div className="pixel-border p-8 text-center">
            <h2 className="text-3xl mb-4">JOIN GAME</h2>
            <p className="mb-2">Wager: {ethers.formatEther(gameData.wager)} ETH</p>
            <p className="mb-2">Difficulty: {gameData.difficulty}/10</p>
            <div className="flex gap-4 justify-center mt-6">
              <button onClick={handleJoinGame} className="pixel-button">
                JOIN GAME
              </button>
              <button onClick={onExit} className="pixel-button">
                BACK TO LOBBY
              </button>
            </div>
          </div>
        </div>
      )
    } else {
      // Player has joined but game not started yet - show waiting
      logger.warn('Game', 'Player has joined but game status is still Pending', {
        gameId,
        account,
        status: gameData.status
      })
      return (
        <div className="max-w-4xl mx-auto">
          <div className="pixel-border p-8 text-center">
            <h2 className="text-3xl mb-4">WAITING FOR HOST</h2>
            <p className="mb-6">You've joined the game. Waiting for the host to start...</p>
            <button onClick={onExit} className="pixel-button">
              BACK TO LOBBY
            </button>
          </div>
        </div>
      )
    }
  }
  
  // Show waiting message if game is Active but not started yet
  if (gameData && gameData.status === 1 && !gameStarted) {
    const isHost = gameData.host.toLowerCase() === account?.toLowerCase()
    const isPlayer = gameData.player && gameData.player.toLowerCase() === account?.toLowerCase()
    const hasPlayer = gameData.player && gameData.player !== '0x0000000000000000000000000000000000000000'
    
    logger.info('Game', 'Active game but not started - showing waiting message', {
      gameId,
      status: gameData.status,
      account,
      host: gameData.host,
      player: gameData.player,
      isHost,
      isPlayer,
      hasPlayer,
      gameStarted
    })
    
    if (isHost && hasPlayer) {
      // Host is here, player has joined - should start soon
      return (
        <div className="max-w-4xl mx-auto">
          <div className="pixel-border p-8 text-center">
            <h2 className="text-3xl mb-4">WAITING FOR PLAYER</h2>
            <p className="mb-6">The other player has joined. Game will start shortly...</p>
            <button onClick={onExit} className="pixel-button">
              BACK TO LOBBY
            </button>
          </div>
        </div>
      )
    } else if (isPlayer && hasPlayer) {
      // Player is here, waiting for host to join
      return (
        <div className="max-w-4xl mx-auto">
          <div className="pixel-border p-8 text-center">
            <h2 className="text-3xl mb-4">WAITING FOR OTHER PLAYER</h2>
            <p className="mb-6">You've joined the game. Waiting for the other player to join...</p>
            <button onClick={onExit} className="pixel-button">
              BACK TO LOBBY
            </button>
          </div>
        </div>
      )
    } else if (isHost && !hasPlayer) {
      // Host is here but player hasn't joined yet
      return (
        <div className="max-w-4xl mx-auto">
          <div className="pixel-border p-8 text-center">
            <h2 className="text-3xl mb-4">WAITING FOR PLAYER</h2>
            <p className="mb-6">Your game is waiting for another player to join.</p>
            <div className="flex gap-4 justify-center">
              <button onClick={handleCancelGame} className="pixel-button">
                CANCEL GAME
              </button>
              <button onClick={onExit} className="pixel-button">
                BACK TO LOBBY
              </button>
            </div>
          </div>
        </div>
      )
    }
  }

  if (practiceMode && !gameStarted && !loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="pixel-border p-8 text-center">
          <h2 className="text-3xl mb-4">PRACTICE MODE</h2>
          <p className="mb-6 text-retro-cyan">Test the game mechanics without blockchain</p>
          <div className="space-y-4">
            <div>
              <label className="block mb-2">Difficulty: {practiceDifficulty}/10</label>
              <input
                type="range"
                min="1"
                max="10"
                value={practiceDifficulty}
                onChange={(e) => setPracticeDifficulty(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <button
              onClick={() => initializeGame(practiceDifficulty)}
              className="pixel-button"
            >
              START PRACTICE GAME
            </button>
            <button onClick={onExit} className="pixel-button">
              BACK TO LOBBY
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (gameOver) {
    const isWinner = practiceMode 
      ? (winner === 'You' || winner === 'left')
      : winner?.toLowerCase() === account?.toLowerCase()
    
    return (
      <div className="max-w-4xl mx-auto">
        <div className="pixel-border p-8 text-center">
          <h2 className="text-4xl mb-4">{isWinner ? 'YOU WIN!' : 'YOU LOST'}</h2>
          <div className="mb-4">
            <p className="text-xl mb-2">Final Score: {score.left} - {score.right}</p>
            {practiceMode ? (
              <p className="text-2xl mb-2">Winner: {winner}</p>
            ) : (
              <>
                <p className="text-2xl mb-2">
                  Winner: {winner ? `${winner.slice(0, 6)}...${winner.slice(-4)}` : 'Unknown'}
                </p>
                {completing ? (
                  <p className="text-retro-cyan mb-4">Processing winnings...</p>
                ) : (
                  <p className="text-retro-green mb-4">Winnings have been automatically distributed!</p>
                )}
              </>
            )}
          </div>
          <button onClick={onExit} className="pixel-button" disabled={completing && !practiceMode}>
            {completing && !practiceMode ? 'PROCESSING...' : 'BACK TO LOBBY'}
          </button>
        </div>
      </div>
    )
  }

  logger.info('Game', 'Rendering: Active game canvas', {
    gameId,
    gameStarted,
    practiceMode,
    score: scoreRef.current
  })
  
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-4 flex justify-between items-center">
        <button onClick={onExit} className="pixel-button">
          EXIT GAME
        </button>
        {practiceMode ? (
          <div className="text-retro-yellow">
            PRACTICE MODE | Difficulty: {practiceDifficulty}/10
          </div>
        ) : gameData && (
          <div className="text-retro-cyan">
            Difficulty: {gameData.difficulty}/10 | Wager: {ethers.formatEther(gameData.wager)} ETH
          </div>
        )}
      </div>
      <div className="pixel-border p-2 sm:p-4 bg-retro-bg flex justify-center items-center overflow-hidden">
        <div 
          className="w-full relative"
          style={{ 
            paddingBottom: `${(CANVAS_HEIGHT / CANVAS_WIDTH) * 100}%`, // Maintain aspect ratio
            maxHeight: '70vh',
            maxWidth: '100%'
          }}
        >
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="absolute top-0 left-0 w-full h-full"
            style={{ 
              imageRendering: 'pixelated',
              objectFit: 'contain'
            }}
          />
        </div>
      </div>
      <div className="mt-4 text-center text-sm text-retro-cyan">
        <p>Use mouse, touch, or arrow keys (↑↓) to move your paddle</p>
        <p className="mt-2 text-retro-yellow">First to 10 points wins!</p>
      </div>
    </div>
  )
}

