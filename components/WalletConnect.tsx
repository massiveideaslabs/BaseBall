'use client'

import { useWallet } from '@/contexts/WalletContext'
import { useState, useEffect, useRef } from 'react'

export default function WalletConnect() {
  const { account, connectMetaMask, connectPhantom, connectWalletConnect, disconnectWallet, isConnected } = useWallet()
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false)
      }
    }

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showMenu])

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  return (
    <div>
      {isConnected && account ? (
        <div className="flex items-center gap-4">
          <span className="text-retro-cyan">{formatAddress(account)}</span>
          <button onClick={disconnectWallet} className="pixel-button">
            DISCONNECT
          </button>
        </div>
      ) : (
        <div className="relative inline-block text-left" ref={menuRef}>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setShowMenu((v) => !v)
            }}
            className="pixel-button"
            style={{
              position: 'relative',
              zIndex: 10,
              cursor: 'pointer',
            }}
          >
            CONNECT WALLET
          </button>

          {showMenu && (
            <div 
              className="absolute right-0 mt-2 w-56 pixel-border bg-retro-bg z-50"
              style={{
                backgroundColor: '#0a0a0a',
                border: '4px solid #00ff00',
                minWidth: '200px',
                zIndex: 9999,
              }}
            >
              <button
                onClick={async () => {
                  setShowMenu(false)
                  try {
                    await connectMetaMask()
                  } catch (error) {
                    console.error('Connection error:', error)
                  }
                }}
                className="w-full text-left px-4 py-2 hover:bg-retro-green hover:text-retro-bg transition"
                style={{
                  color: '#00ff00',
                  padding: '12px 16px',
                  cursor: 'pointer',
                }}
              >
                MetaMask
              </button>
              <button
                onClick={async () => {
                  setShowMenu(false)
                  try {
                    await connectPhantom()
                  } catch (error) {
                    console.error('Connection error:', error)
                  }
                }}
                className="w-full text-left px-4 py-2 hover:bg-retro-green hover:text-retro-bg transition"
                style={{
                  color: '#00ff00',
                  padding: '12px 16px',
                  cursor: 'pointer',
                }}
              >
                Phantom
              </button>
              <button
                onClick={async () => {
                  setShowMenu(false)
                  try {
                    await connectWalletConnect()
                  } catch (error) {
                    console.error('Connection error:', error)
                  }
                }}
                className="w-full text-left px-4 py-2 hover:bg-retro-green hover:text-retro-bg transition"
                style={{
                  color: '#00ff00',
                  padding: '12px 16px',
                  cursor: 'pointer',
                }}
              >
                WalletConnect
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}



