'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { ethers } from 'ethers'

const BASE_SEPOLIA_CHAIN_ID = 84532
const BASE_SEPOLIA_CHAIN_ID_HEX = '0x14A34'
const BASE_SEPOLIA_PARAMS = {
  chainId: BASE_SEPOLIA_CHAIN_ID_HEX,
  chainName: 'Base Sepolia',
  rpcUrls: ['https://sepolia.base.org'],
  blockExplorerUrls: ['https://sepolia.basescan.org'],
  nativeCurrency: {
    name: 'Base Sepolia ETH',
    symbol: 'ETH',
    decimals: 18,
  },
}

// Prefer MetaMask when multiple EIP-1193 providers are present
const getPreferredEip1193Provider = (): any | null => {
  if (typeof window === 'undefined') return null
  const anyWindow = window as any
  const eth = anyWindow.ethereum
  if (!eth) return null

  // Multiple injected providers (MetaMask, Phantom EVM, etc.)
  if (Array.isArray(eth.providers) && eth.providers.length > 0) {
    const metamask = eth.providers.find((p: any) => p.isMetaMask)
    if (metamask) return metamask
    return eth.providers[0]
  }

  return eth
}

interface WalletContextType {
  account: string | null
  provider: ethers.BrowserProvider | null
  signer: ethers.JsonRpcSigner | null
  connectMetaMask: () => Promise<void>
  connectPhantom: () => Promise<void>
  disconnectWallet: () => void
  isConnected: boolean
  isCorrectNetwork: boolean
  requiredChainId: number
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

export function WalletProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<string | null>(null)
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null)
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null)
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(true)

  useEffect(() => {
    checkConnection()
  }, [])

  const ensureCorrectNetwork = async (browserProvider: ethers.BrowserProvider) => {
    try {
      const network = await browserProvider.getNetwork()
      if (network.chainId === BigInt(BASE_SEPOLIA_CHAIN_ID)) {
        setIsCorrectNetwork(true)
        return true
      }

      try {
        await browserProvider.send('wallet_switchEthereumChain', [
          { chainId: BASE_SEPOLIA_CHAIN_ID_HEX },
        ])
        setIsCorrectNetwork(true)
        return true
      } catch (switchError: any) {
        if (switchError?.code === 4902) {
          // Chain not added yet
          try {
            await browserProvider.send('wallet_addEthereumChain', [BASE_SEPOLIA_PARAMS])
            setIsCorrectNetwork(true)
            return true
          } catch (addError) {
            console.error('Error adding Base Sepolia network:', addError)
          }
        } else if (switchError?.code === 4001) {
          console.warn('User rejected network switch request')
        } else {
          console.error('wallet_switchEthereumChain error:', switchError)
        }
      }
    } catch (error) {
      console.error('Error ensuring correct network:', error)
    }

    alert('Please switch your wallet network to Base Sepolia testnet to play Base Ball.')
    setIsCorrectNetwork(false)
    return false
  }

  const checkConnection = async () => {
    // Try to restore previous connection if wallet is already authorized
    const eipProvider = getPreferredEip1193Provider()
    if (!eipProvider) return

    try {
      const browserProvider = new ethers.BrowserProvider(eipProvider)
      const accounts = await browserProvider.listAccounts()
      if (accounts.length > 0) {
        const networkOk = await ensureCorrectNetwork(browserProvider)
        if (!networkOk) {
          setProvider(browserProvider)
          return
        }
        const connectedSigner = await browserProvider.getSigner()
        setProvider(browserProvider)
        setSigner(connectedSigner)
        setAccount(accounts[0].address)
      }
    } catch (error) {
      console.error('Error checking connection:', error)
    }
  }

  const connectMetaMask = async () => {
    if (typeof window === 'undefined') return
    const anyWindow = window as any
    const eth = anyWindow.ethereum

    // MetaMask may expose multiple providers
    let mmProvider: any | null = null
    if (eth?.providers && Array.isArray(eth.providers)) {
      mmProvider = eth.providers.find((p: any) => p.isMetaMask) || null
    } else if (eth?.isMetaMask) {
      mmProvider = eth
    }

    if (!mmProvider) {
      alert('MetaMask not detected. Please install MetaMask to use this option.')
      return
    }

    try {
      const browserProvider = new ethers.BrowserProvider(mmProvider)
      await browserProvider.send('eth_requestAccounts', [])
      const networkOk = await ensureCorrectNetwork(browserProvider)
      if (!networkOk) return
      const signer = await browserProvider.getSigner()
      const address = await signer.getAddress()

      setProvider(browserProvider)
      setSigner(signer)
      setAccount(address)
    } catch (error) {
      console.error('MetaMask connection error:', error)
      alert('Failed to connect MetaMask. Please check the extension and try again.')
    }
  }

  const connectPhantom = async () => {
    if (typeof window === 'undefined') return
    const anyWindow = window as any
    const phantomEth = anyWindow.phantom?.ethereum

    if (!phantomEth) {
      alert('Phantom EVM wallet not detected. Please install Phantom or use MetaMask.')
      return
    }

    try {
      const browserProvider = new ethers.BrowserProvider(phantomEth)
      await browserProvider.send('eth_requestAccounts', [])
      const networkOk = await ensureCorrectNetwork(browserProvider)
      if (!networkOk) return
      const signer = await browserProvider.getSigner()
      const address = await signer.getAddress()

      setProvider(browserProvider)
      setSigner(signer)
      setAccount(address)
    } catch (error) {
      console.error('Phantom connection error:', error)
      alert('Failed to connect Phantom. Please check the extension and try again.')
    }
  }

  const disconnectWallet = () => {
    setAccount(null)
    setProvider(null)
    setSigner(null)
    setIsCorrectNetwork(true)
  }

  return (
    <WalletContext.Provider
      value={{
        account,
        provider,
        signer,
        connectMetaMask,
        connectPhantom,
        disconnectWallet,
        isConnected: !!account,
        isCorrectNetwork,
        requiredChainId: BASE_SEPOLIA_CHAIN_ID,
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  const context = useContext(WalletContext)
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider')
  }
  return context
}



