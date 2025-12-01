# Base Ball 🎮

A multiplayer blockchain-based Pong game built on Base chain. Players can wager ETH on matches, with 10 difficulty levels and retro 8-bit styling.

## Features

- 🎮 Classic Pong gameplay with online multiplayer
- 💰 Blockchain-based wagering system on Base chain
- 🎯 10 difficulty levels affecting ball speed
- 🏆 Leaderboard with player stats (full leaderboard requires event indexing)
- 🎨 Retro 8-bit pixel art design
- 👛 Phantom wallet integration (also supports MetaMask)
- 🔒 Contract-based escrow for secure wager holding
- 💸 1% platform fee on completed games

## Prerequisites

- Node.js 18+ and npm
- Phantom wallet (or MetaMask) browser extension
- Base chain network access
- Hardhat for smart contract deployment

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd gxv
```

2. Install dependencies:
```bash
npm install
cd server && npm install && cd ..
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and add:
- `PRIVATE_KEY`: Your wallet private key for deployment
- `FEE_WALLET_ADDRESS`: Your wallet address to receive the 1% fee
- `BASE_RPC_URL`: Base mainnet RPC URL (or use default)
- `NEXT_PUBLIC_CONTRACT_ADDRESS`: Will be set after deployment

## Smart Contract Deployment

1. Compile the contracts:
```bash
npm run compile
```

2. Deploy to Base network:
```bash
npm run deploy:base
```

3. Copy the deployed contract address to your `.env` file as `NEXT_PUBLIC_CONTRACT_ADDRESS`

## Running the Application

1. Start the game server (for multiplayer):
```bash
cd server
npm start
```

2. In a new terminal, start the frontend:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

## How to Play

1. **Connect Wallet**: Click "CONNECT WALLET" and connect your Phantom wallet
2. **Create or Join Game**: 
   - Create a game by setting your wager amount and difficulty (1-10)
   - Or join an existing game from the lobby
3. **Play**: 
   - Use your mouse or arrow keys (↑↓) to move your paddle
   - First to 10 points wins (winnings automatically distributed)
   - Ball speed increases after every 10 touches
4. **Win**: The winner receives both wagers (minus 1% platform fee)

## Game Mechanics

- **Difficulty Levels**: 10 levels affecting starting ball speed
- **Ball Speed**: Increases after every 10 paddle touches
- **Speed Increase**: Higher difficulty = larger speed increases per touch
- **Controls**: Mouse movement or arrow keys (up/down)
- **Scoring**: First player to 10 points wins (automatic payout)

## Smart Contract Details

### BaseBall Contract

The main contract handles:
- Game creation with wager and difficulty
- Game joining (matching wager)
- Game cancellation (refund to host)
- Game completion (winner payout with 1% fee)
- Player statistics tracking

### Escrow Mechanism

The contract uses a contract-based escrow system where wagers are held in the contract itself. This is functionally equivalent to a multi-signature wallet for this use case:
- When a host creates a game, their wager is locked in the contract
- When a player joins, their matching wager is also locked
- Only the contract can release funds (to winner or back to host on cancellation)
- This approach is more gas-efficient than traditional multi-sig wallets while providing the same security guarantees

### Key Functions

- `createGame(uint8 difficulty)`: Create a new game with ETH wager
- `joinGame(uint256 gameId)`: Join an existing game
- `cancelGame(uint256 gameId)`: Cancel pending game (host only)
- `completeGame(uint256 gameId, address winner)`: Complete game and pay winner

## Project Structure

```
gxv/
├── app/                 # Next.js app directory
│   ├── components/      # React components
│   ├── contexts/        # React contexts (Wallet)
│   └── lib/            # Utilities and contract interactions
├── contracts/          # Solidity smart contracts
├── scripts/            # Deployment scripts
├── server/             # Socket.io game server
└── public/             # Static assets
```

## Development

- Frontend: Next.js 14 with TypeScript
- Smart Contracts: Solidity 0.8.20
- Blockchain: Base (Ethereum L2)
- Wallet: Phantom/MetaMask
- Styling: Tailwind CSS with custom retro theme

## Security Notes

- Always test on testnet before mainnet deployment
- Never share your private keys
- Verify smart contracts on BaseScan after deployment
- The 1% fee is only collected on completed games, not cancellations

## License

MIT

## Support

For issues or questions, please open an issue on GitHub.

---

**Built on Base Chain** ⚡ | **Play at your own risk** ⚠️

