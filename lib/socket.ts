import { io, Socket } from 'socket.io-client'

const GAME_SERVER_URL = process.env.NEXT_PUBLIC_GAME_SERVER_URL || 'http://localhost:3001'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io(GAME_SERVER_URL, {
      transports: ['websocket'],
    })
  }
  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}



