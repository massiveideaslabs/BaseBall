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
    // First, estimate gas to get a better error message if it fails
    const gasEstimate = await contract.createGame.estimateGas(
      difficulty,
      expirationDurationSeconds,
      {
        value: wagerWei,
      }
    )
    
    console.log('Gas estimate:', gasEstimate.toString())
    
    // Now send the transaction
    const tx = await contract.createGame(difficulty, expirationDurationSeconds, {
      value: wagerWei,
      gasLimit: gasEstimate + BigInt(50000), // Add 20% buffer
    })
    await tx.wait()
    return tx
  } catch (error: any) {
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
    if (error?.message?.includes('insufficient funds')) {
      throw new Error('Insufficient funds in your wallet')
    }
    
    if (error?.message?.includes('user rejected')) {
      throw new Error('Transaction was cancelled')
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
  const contract = new ethers.Contract(
    CONTRACT_ADDRESS,
    BaseBallABI,
    provider
  )
  return await contract.getGame(gameId)
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



