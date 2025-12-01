'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { ethers } from 'ethers'
import { EthereumProvider } from '@walletconnect/ethereum-provider'

type EthereumProviderType = InstanceType<typeof EthereumProvider>

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
  connectWalletConnect: () => Promise<void>
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
  const [walletConnectProvider, setWalletConnectProvider] = useState<EthereumProviderType | null>(null)

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

  const isMobile = () => {
    if (typeof window === 'undefined') return false
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
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
      // On mobile, try to open MetaMask app
      if (isMobile()) {
        const currentUrl = window.location.href
        // Try MetaMask deep link
        const metamaskUrl = `https://metamask.app.link/dapp/${encodeURIComponent(currentUrl)}`
        const userConfirmed = confirm(
          'MetaMask not detected in browser. Would you like to open the MetaMask app?\n\n' +
          'If you have MetaMask installed, click OK to open it. Otherwise, please install MetaMask from the App Store or Google Play.'
        )
        if (userConfirmed) {
          window.location.href = metamaskUrl
          // Fallback: try direct deep link
          setTimeout(() => {
            window.location.href = 'metamask://'
          }, 500)
        }
        return
      } else {
        alert('MetaMask not detected. Please install MetaMask extension to use this option.')
        return
      }
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

  const connectWalletConnect = async () => {
    if (typeof window === 'undefined') return

    const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim()
    
    // Debug: log the project ID (first few chars only for security)
    console.log('WalletConnect Project ID check:', projectId ? `${projectId.substring(0, 8)}...` : 'NOT FOUND')
    
    if (!projectId || projectId === 'YOUR_PROJECT_ID' || projectId === '') {
      alert(
        'WalletConnect Project ID not configured.\n\n' +
        'To use WalletConnect:\n' +
        '1. Go to https://cloud.walletconnect.com and create a free account\n' +
        '2. Create a new project and copy your Project ID\n' +
        '3. Add NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id to your .env file\n' +
        '4. Add the same variable in Vercel: Settings → Environment Variables\n' +
        '5. Redeploy your application (Vercel auto-redeploys after env var changes)\n\n' +
        'Current value: ' + (projectId || 'undefined') + '\n\n' +
        'For now, please use MetaMask or Phantom.'
      )
      return
    }

    try {
      // Initialize WalletConnect provider
      const wcProvider = await EthereumProvider.init({
        projectId,
        chains: [BASE_SEPOLIA_CHAIN_ID],
        optionalChains: [],
        showQrModal: true,
        metadata: {
          name: 'Base Ball',
          description: 'Multiplayer blockchain-based Pong game on Base chain',
          url: typeof window !== 'undefined' ? window.location.origin : '',
          icons: [`${typeof window !== 'undefined' ? window.location.origin : ''}/favicon.ico`],
        },
      })

      // Check if already connected
      if (wcProvider.session) {
        // Already have a session, use it
        const accounts = wcProvider.accounts
        if (accounts.length > 0) {
          const browserProvider = new ethers.BrowserProvider(wcProvider as any)
          const networkOk = await ensureCorrectNetwork(browserProvider)
          if (!networkOk) {
            await wcProvider.disconnect()
            return
          }
          const signer = await browserProvider.getSigner()
          const address = await signer.getAddress()
          setWalletConnectProvider(wcProvider)
          setProvider(browserProvider)
          setSigner(signer)
          setAccount(address)
          
          // Set up event listeners
          wcProvider.on('disconnect', () => {
            disconnectWallet()
          })
          wcProvider.on('accountsChanged', (accounts: string[]) => {
            if (accounts.length > 0) {
              setAccount(accounts[0])
            } else {
              disconnectWallet()
            }
          })
          return
        }
      }

      // Enable session - this will show the QR modal
      await wcProvider.enable()

      // Wait for session to be established by polling for accounts
      // This ensures we wait for user approval
      let attempts = 0
      const maxAttempts = 60 // 30 seconds max wait
      while (wcProvider.accounts.length === 0 && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 500))
        attempts++
      }

      // Get accounts after waiting
      const accounts = wcProvider.accounts
      if (accounts.length === 0) {
        throw new Error('Connection timeout. Please try again and approve the connection in your wallet.')
      }

      // Create ethers provider from WalletConnect provider
      const browserProvider = new ethers.BrowserProvider(wcProvider as any)
      
      // Check network
      const networkOk = await ensureCorrectNetwork(browserProvider)
      if (!networkOk) {
        await wcProvider.disconnect()
        return
      }

      const signer = await browserProvider.getSigner()
      const address = await signer.getAddress()

      setWalletConnectProvider(wcProvider)
      setProvider(browserProvider)
      setSigner(signer)
      setAccount(address)

      // Listen for disconnect
      wcProvider.on('disconnect', () => {
        disconnectWallet()
      })

      // Listen for account changes
      wcProvider.on('accountsChanged', (accounts: string[]) => {
        if (accounts.length > 0) {
          setAccount(accounts[0])
        } else {
          disconnectWallet()
        }
      })
    } catch (error: any) {
      console.error('WalletConnect connection error:', error)
      if (error?.message?.includes('User rejected') || error?.message?.includes('rejected')) {
        return // User cancelled, don't show error
      }
      if (error?.message?.includes('No accounts found')) {
        alert('Connection was not approved. Please try again and approve the connection in your wallet.')
      } else {
        alert(`Failed to connect via WalletConnect: ${error?.message || 'Unknown error'}`)
      }
    }
  }

  const disconnectWallet = async () => {
    // Disconnect WalletConnect if connected
    if (walletConnectProvider) {
      try {
        await walletConnectProvider.disconnect()
      } catch (error) {
        console.error('Error disconnecting WalletConnect:', error)
      }
      setWalletConnectProvider(null)
    }
    
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
        connectWalletConnect,
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



