import { ethers } from 'ethers'
import BaseBallABI from './BaseBallABI.json'

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || ''

export interface Game {
  host: string
  player: string
  wager: bigint
  difficulty: number
  status: number
  gameId: bigint
  createdAt: bigint
  expiresAt: bigint
}

export interface PlayerStats {
  wins: bigint
  totalWinnings: bigint
  gamesPlayed: bigint
}

export async function getContract(signer: ethers.JsonRpcSigner) {
  if (!CONTRACT_ADDRESS) {
    throw new Error('Contract address not configured. Please set NEXT_PUBLIC_CONTRACT_ADDRESS environment variable.')
  }
  
  // Verify contract exists by checking code
  const code = await signer.provider.getCode(CONTRACT_ADDRESS)
  if (code === '0x') {
    throw new Error(`No contract found at address ${CONTRACT_ADDRESS}. Please verify the contract address is correct.`)
  }
  
  return new ethers.Contract(CONTRACT_ADDRESS, BaseBallABI, signer)
}

export async function createGame(
  signer: ethers.JsonRpcSigner,
  difficulty: number,
  wager: string,
  expirationDurationSeconds: number
) {
  // Validate inputs
  if (!CONTRACT_ADDRESS) {
    throw new Error('Contract address not configured. Please set NEXT_PUBLIC_CONTRACT_ADDRESS')
  }
  
  const wagerWei = ethers.parseEther(wager)
  if (wagerWei === 0n) {
    throw new Error('Wager must be greater than 0')
  }
  
  if (difficulty < 1 || difficulty > 10) {
    throw new Error('Difficulty must be between 1 and 10')
  }
  
  if (expirationDurationSeconds <= 0) {
    throw new Error('Expiration duration must be greater than 0')
  }
  
  const contract = await getContract(signer)
  
  try {
    // Try to estimate gas first, but if it fails, we'll use a default gas limit
    let gasLimit: bigint | undefined = undefined
    
    try {
      const gasEstimate = await contract.createGame.estimateGas(
        difficulty,
        expirationDurationSeconds,
        {
          value: wagerWei,
        }
      )
      console.log('Gas estimate:', gasEstimate.toString())
      gasLimit = gasEstimate + (gasEstimate / BigInt(5)) // Add 20% buffer
    } catch (estimateError: any) {
      console.warn('Gas estimation failed, using default gas limit:', estimateError)
      // If gas estimation fails, use a reasonable default (200k gas should be enough for createGame)
      gasLimit = BigInt(200000)
    }
    
    // Send the transaction
    const txOptions: any = {
      value: wagerWei,
    }
    
    if (gasLimit) {
      txOptions.gasLimit = gasLimit
    }
    
    const tx = await contract.createGame(difficulty, expirationDurationSeconds, txOptions)
    const receipt = await tx.wait()
    
    // Extract gameId from the GameCreated event
    let gameId: number | null = null
    if (receipt?.logs) {
      const eventInterface = contract.interface
      for (const log of receipt.logs) {
        try {
          const parsedLog = eventInterface.parseLog(log)
          if (parsedLog && parsedLog.name === 'GameCreated') {
            gameId = Number(parsedLog.args.gameId)
            console.log('Game created with ID:', gameId)
            break
          }
        } catch {
          // Not the event we're looking for, continue
        }
      }
    }
    
    // If we couldn't find the event, try to get it from the return value
    if (gameId === null && receipt) {
      // The transaction receipt might have the return value
      // But since createGame returns a value, we need to decode it
      // For now, we'll query the gameCounter or use getAllPendingGames to find the latest
      console.warn('Could not extract gameId from events, will need to query for it')
    }
    
    return { tx, gameId }
  } catch (error: any) {
    console.error('Error in createGame:', error)
    
    // Provide more helpful error messages
    if (error?.data) {
      // Try to decode the revert reason
      try {
        const reason = contract.interface.parseError(error.data)
        throw new Error(`Contract error: ${reason?.name || 'Unknown error'}`)
      } catch {
        // If we can't decode, use the original error
      }
    }
    
    // Check for common error patterns
    if (error?.message?.includes('insufficient funds') || error?.code === 'INSUFFICIENT_FUNDS') {
      throw new Error('Insufficient funds in your wallet')
    }
    
    if (error?.message?.includes('user rejected') || error?.code === 4001) {
      throw new Error('Transaction was cancelled')
    }
    
    if (error?.message?.includes('missing revert data')) {
      // This usually means the contract call would fail but RPC doesn't provide reason
      // Try to provide helpful guidance
      throw new Error('Transaction would fail. Please check: 1) Contract exists at address, 2) You have sufficient funds, 3) Parameters are valid (difficulty 1-10, expiration > 0)')
    }
    
    // Re-throw with original message
    throw error
  }
}

export async function joinGame(
  signer: ethers.JsonRpcSigner,
  gameId: number,
  wager: string
) {
  const contract = await getContract(signer)
  const tx = await contract.joinGame(gameId, {
    value: ethers.parseEther(wager),
  })
  await tx.wait()
  return tx
}

export async function cancelGame(signer: ethers.JsonRpcSigner, gameId: number) {
  const contract = await getContract(signer)
  const tx = await contract.cancelGame(gameId)
  await tx.wait()
  return tx
}

export async function completeGame(
  signer: ethers.JsonRpcSigner,
  gameId: number,
  winner: string
) {
  const contract = await getContract(signer)
  const tx = await contract.completeGame(gameId, winner)
  await tx.wait()
  return tx
}

export async function getGame(
  provider: ethers.BrowserProvider,
  gameId: number
): Promise<Game> {
  if (!CONTRACT_ADDRESS) {
    throw new Error('Contract address not configured. Please set NEXT_PUBLIC_CONTRACT_ADDRESS environment variable.')
  }
  
  const contract = new ethers.Contract(
    CONTRACT_ADDRESS,
    BaseBallABI,
    provider
  )
  
  try {
    const game = await contract.getGame(gameId)
    
    // Validate that the game exists (non-existent games will have gameId = 0 and host = zero address)
    // Check both gameId and host to be sure
    if (game.gameId === 0n || game.host === '0x0000000000000000000000000000000000000000') {
      throw new Error(`Game ${gameId} does not exist`)
    }
    
    return game
  } catch (error: any) {
    // Re-throw with more context if it's already our custom error
    if (error.message?.includes('does not exist')) {
      throw error
    }
    
    // Wrap other errors with more context
    const errorMessage = error?.message || error?.toString() || 'Unknown error'
    throw new Error(`Failed to fetch game ${gameId}: ${errorMessage}`)
  }
}

export async function getAllPendingGames(
  provider: ethers.BrowserProvider
): Promise<Game[]> {
  const contract = new ethers.Contract(
    CONTRACT_ADDRESS,
    BaseBallABI,
    provider
  )
  return await contract.getAllPendingGames()
}

export async function getPlayerStats(
  provider: ethers.BrowserProvider,
  address: string
): Promise<PlayerStats> {
  const contract = new ethers.Contract(
    CONTRACT_ADDRESS,
    BaseBallABI,
    provider
  )
  return await contract.getPlayerStats(address)
}

export async function cancelExpiredGame(signer: ethers.JsonRpcSigner, gameId: number) {
  const contract = await getContract(signer)
  const tx = await contract.cancelExpiredGame(gameId)
  await tx.wait()
  return tx
}



