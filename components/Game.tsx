'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useWallet } from '@/contexts/WalletContext'
import { getGame, joinGame, cancelGame, completeGame, Game as GameData } from '@/lib/contract'
import { ethers } from 'ethers'

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

  useEffect(() => {
    if (practiceMode) {
      // Practice mode - skip blockchain, just show difficulty selector
      setLoading(false)
    } else if (gameId && provider) {
      loadGame()
    } else if (!gameId) {
      // Creating new game
      setLoading(false)
    }
  }, [gameId, provider, practiceMode])

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

  const loadGame = async () => {
    if (!gameId || !provider) return
    try {
      const data = await getGame(provider, gameId)
      setGameData(data)
      setLoading(false)

      // If game is active and player is part of it, start the game
      if (data.status === 1 && (data.host.toLowerCase() === account?.toLowerCase() || data.player.toLowerCase() === account?.toLowerCase())) {
        initializeGame(data.difficulty)
      }
    } catch (error) {
      console.error('Error loading game:', error)
      setLoading(false)
    }
  }

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
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <p className="text-retro-cyan text-xl">LOADING GAME...</p>
      </div>
    )
  }

  if (!gameData && gameId) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <p className="text-retro-red text-xl">GAME NOT FOUND</p>
      </div>
    )
  }

  if (gameData && gameData.status === 0 && gameData.host.toLowerCase() === account?.toLowerCase()) {
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

  if (gameData && gameData.status === 0 && gameData.host.toLowerCase() !== account?.toLowerCase()) {
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
      <div className="pixel-border p-4 bg-retro-bg">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="w-full"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>
      <div className="mt-4 text-center text-sm text-retro-cyan">
        <p>Use mouse, touch, or arrow keys (↑↓) to move your paddle</p>
        <p className="mt-2 text-retro-yellow">First to 10 points wins!</p>
      </div>
    </div>
  )
}

