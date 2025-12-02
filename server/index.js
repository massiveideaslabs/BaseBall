const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();

// CORS configuration
// Support multiple client URLs (comma-separated) or single CLIENT_URL
const clientUrls = process.env.CLIENT_URL 
  ? process.env.CLIENT_URL.split(',').map(url => url.trim())
  : [];
const allowedOrigins = [
  ...clientUrls,
  "http://localhost:3000",
  "https://base-ball-ten.vercel.app", // Add Vercel deployment URL
  "https://base-ball-ten.vercel.app/", // With trailing slash
];

console.log('[SERVER] Allowed CORS origins:', allowedOrigins);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      console.log('[SERVER] Request with no origin - allowing');
      return callback(null, true);
    }
    console.log('[SERVER] CORS check for origin:', origin);
    if (allowedOrigins.indexOf(origin) !== -1) {
      console.log('[SERVER] Origin allowed:', origin);
      callback(null, true);
    } else {
      console.log('[SERVER] Origin NOT allowed:', origin);
      console.log('[SERVER] Allowed origins:', allowedOrigins);
      callback(new Error(`Not allowed by CORS. Origin: ${origin}`));
    }
  },
  credentials: true
}));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      // Allow requests with no origin
      if (!origin) {
        console.log('[SERVER] Socket.io connection with no origin - allowing');
        return callback(null, true);
      }
      console.log('[SERVER] Socket.io CORS check for origin:', origin);
      if (allowedOrigins.indexOf(origin) !== -1) {
        console.log('[SERVER] Socket.io origin allowed:', origin);
        callback(null, true);
      } else {
        console.log('[SERVER] Socket.io origin NOT allowed:', origin);
        callback(new Error(`Not allowed by CORS. Origin: ${origin}`));
      }
    },
    methods: ["GET", "POST"],
    credentials: true
  }
});

const activeGames = new Map();

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  socket.on('join-game', (gameId) => {
    socket.join(`game-${gameId}`);
    if (!activeGames.has(gameId)) {
      activeGames.set(gameId, {
        players: [],
        ball: null,
        scores: { left: 0, right: 0 }
      });
    }
    const game = activeGames.get(gameId);
    if (game.players.length < 2) {
      game.players.push(socket.id);
      socket.emit('game-joined', { playerNumber: game.players.length });
      io.to(`game-${gameId}`).emit('player-count', game.players.length);
    }
  });

  // Handle game creation event
  socket.on('game-created', () => {
    socket.broadcast.emit('game-created');
  });

  // Handle game joined event
  socket.on('game-joined', (data) => {
    console.log('[SERVER] Game joined event received:', JSON.stringify(data, null, 2));
    console.log('[SERVER] Socket ID:', socket.id);
    console.log('[SERVER] Broadcasting to all clients...');
    
    // Broadcast to all clients
    socket.broadcast.emit('game-joined', data);
    console.log('[SERVER] Broadcasted game-joined event');
    
    // Emit specific event for the host (if host is provided)
    if (data.host) {
      console.log('[SERVER] Emitting player-joined-game event for host:', data.host);
      socket.broadcast.emit('player-joined-game', {
        gameId: data.gameId,
        host: data.host,
        player: data.player
      });
      console.log('[SERVER] Broadcasted player-joined-game event');
    } else {
      console.log('[SERVER] WARNING: No host provided in game-joined event');
    }
  });

  // Handle game cancelled event
  socket.on('game-cancelled', (data) => {
    socket.broadcast.emit('game-cancelled', data);
  });

  socket.on('paddle-move', (data) => {
    const { gameId, y } = data;
    socket.to(`game-${gameId}`).emit('opponent-paddle', { y });
  });

  socket.on('ball-update', (data) => {
    const { gameId, ball } = data;
    socket.to(`game-${gameId}`).emit('ball-sync', ball);
  });

  socket.on('score-update', (data) => {
    const { gameId, scores } = data;
    io.to(`game-${gameId}`).emit('score-sync', scores);
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    // Clean up games when players disconnect
    for (const [gameId, game] of activeGames.entries()) {
      const index = game.players.indexOf(socket.id);
      if (index > -1) {
        game.players.splice(index, 1);
        if (game.players.length === 0) {
          activeGames.delete(gameId);
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Game server running on port ${PORT}`);
});



