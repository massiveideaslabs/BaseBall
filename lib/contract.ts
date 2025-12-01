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
  return new ethers.Contract(CONTRACT_ADDRESS, BaseBallABI, signer)
}

export async function createGame(
  signer: ethers.JsonRpcSigner,
  difficulty: number,
  wager: string,
  expirationDurationSeconds: number
) {
  const contract = await getContract(signer)
  const tx = await contract.createGame(difficulty, expirationDurationSeconds, {
    value: ethers.parseEther(wager),
  })
  await tx.wait()
  return tx
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



