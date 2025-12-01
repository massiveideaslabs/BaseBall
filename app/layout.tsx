import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Base Ball - Blockchain Pong',
  description: 'Multiplayer blockchain-based Pong game on Base chain',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='%2300ff00'/></svg>" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preload" href="https://fonts.gstatic.com/s/pressstart2p/v14/e3t4euO8T-267oIAQAu6jDQyK3nVivM.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet" />
      </head>
      <body 
        className="bg-retro-bg text-retro-green font-pixel"
        style={{
          backgroundColor: '#0a0a0a',
          color: '#00ff00',
          fontFamily: '"Press Start 2P", "Courier New", monospace',
        }}
      >
        {children}
      </body>
    </html>
  )
}



