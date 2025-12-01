# Architecture Overview

## System Components

### 1. Smart Contracts (Base Chain)

**BaseBall.sol** - Main game contract
- Manages game lifecycle (create, join, cancel, complete)
- Holds wagers in contract escrow
- Tracks player statistics
- Distributes winnings and collects fees

**Escrow Mechanism:**
- Wagers are held in the contract itself (contract-based escrow)
- More gas-efficient than traditional multi-sig wallets
- Provides same security: funds can only be released by contract logic
- Host can cancel before player joins (refund)
- Winner receives both wagers minus 1% fee on completion

### 2. Frontend (Next.js)

**Components:**
- `Lobby.tsx` - Game listing and creation
- `Game.tsx` - Pong game canvas and logic
- `Leaderboard.tsx` - Player statistics display
- `WalletConnect.tsx` - Wallet connection UI

**Contexts:**
- `WalletContext.tsx` - Manages wallet connection state

**Libraries:**
- `contract.ts` - Contract interaction helpers
- `socket.ts` - Socket.io client for multiplayer

### 3. Game Server (Socket.io)

Real-time multiplayer synchronization:
- Player connection management
- Paddle position synchronization
- Ball state synchronization
- Score updates

## Data Flow

### Game Creation Flow
1. User connects wallet
2. User creates game with wager and difficulty
3. Transaction sent to contract
4. Wager locked in contract
5. Game appears in lobby

### Game Joining Flow
1. User selects game from lobby
2. User joins game (matching wager)
3. Transaction sent to contract
4. Both wagers locked in contract
5. Game status changes to Active
6. Players connect to game server
7. Game begins

### Game Completion Flow
1. Player reaches 10 points
2. Frontend automatically calls `completeGame()` with winner address
3. Contract calculates winnings (total - 1% fee)
4. Fee sent to fee wallet
5. Winnings automatically sent to winner
6. Player stats updated
7. Game status set to Completed

## Multiplayer Architecture

### Current Implementation
- Game logic runs client-side
- Socket.io server syncs paddle positions and ball state
- One player acts as "host" and broadcasts ball state
- Other player receives and renders opponent's paddle

### Future Improvements
- Server-authoritative game state (prevents cheating)
- Lag compensation
- Reconnection handling
- Spectator mode

## Leaderboard

### Current Implementation
- Player stats stored on-chain
- Individual player lookup via `getPlayerStats()`
- Top 20 lists require off-chain event indexing

### Recommended Enhancement
- Index contract events (GameCompleted)
- Build sorted leaderboard off-chain
- Store in database or use The Graph
- Serve via API endpoint

## Security Considerations

1. **Smart Contract:**
   - Only contract owner can set fee wallet
   - Winner must be a game participant
   - Reentrancy protection (using simple transfer pattern)
   - Input validation (difficulty 1-10, wager > 0)

2. **Frontend:**
   - Wallet connection validation
   - Transaction confirmation before state updates
   - Error handling for failed transactions

3. **Game Server:**
   - CORS protection
   - Rate limiting (recommended)
   - Input validation

## Gas Optimization

- Contract uses minimal storage
- Events for off-chain indexing
- Batch operations where possible
- Efficient data structures

## Scalability

### Current Limitations
- Leaderboard requires off-chain indexing
- Game server handles all games (single instance)
- No persistent game state storage

### Scaling Options
1. **Leaderboard:** Use The Graph or custom indexer
2. **Game Server:** Horizontal scaling with Redis pub/sub
3. **State:** Store game state in database for recovery

## Testing Recommendations

1. **Smart Contracts:**
   - Unit tests for all functions
   - Edge cases (zero wager, invalid difficulty)
   - Reentrancy tests
   - Gas usage tests

2. **Frontend:**
   - Wallet connection flows
   - Game creation/joining
   - Error states
   - Responsive design

3. **Integration:**
   - End-to-end game flow
   - Multiplayer synchronization
   - Contract event handling

