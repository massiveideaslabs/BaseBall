# Quick Start Guide

Get Base Ball up and running in 5 minutes!

## Prerequisites Check

- [ ] Node.js 18+ installed (`node --version`)
- [ ] npm installed (`npm --version`)
- [ ] Phantom wallet or MetaMask browser extension
- [ ] Base network added to wallet (Chain ID: 8453)

## Step 1: Install Dependencies

```bash
npm install
cd server && npm install && cd ..
```

## Step 2: Configure Environment

Create `.env` file:
```bash
PRIVATE_KEY=your_private_key_here
FEE_WALLET_ADDRESS=your_fee_wallet_address
BASE_RPC_URL=https://mainnet.base.org
NEXT_PUBLIC_CONTRACT_ADDRESS=  # Will be set after deployment
NEXT_PUBLIC_GAME_SERVER_URL=http://localhost:3001
```

## Step 3: Deploy Smart Contract (Testnet First!)

For Base Sepolia testnet:
```bash
# Update hardhat.config.ts to use baseSepolia
npm run compile
npm run deploy:base  # Make sure BASE_SEPOLIA_RPC_URL is set
```

Copy the deployed address to `.env` as `NEXT_PUBLIC_CONTRACT_ADDRESS`

## Step 4: Start Services

**Terminal 1 - Game Server:**
```bash
cd server
npm start
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

## Step 5: Play!

1. Open http://localhost:3000
2. Click "CONNECT WALLET"
3. Create or join a game
4. Play Pong!

## Troubleshooting

### "Contract not found"
- Make sure contract is deployed
- Check `NEXT_PUBLIC_CONTRACT_ADDRESS` in `.env`
- Restart Next.js dev server

### "Failed to connect wallet"
- Make sure Phantom/MetaMask is installed
- Check that Base network is added
- Try refreshing the page

### "Game server connection failed"
- Make sure server is running on port 3001
- Check `NEXT_PUBLIC_GAME_SERVER_URL` in `.env`
- Check firewall settings

### Transaction fails
- Ensure you have ETH for gas fees
- Check network (should be Base)
- Verify contract address is correct

## Next Steps

- Read [README.md](./README.md) for full documentation
- Check [ARCHITECTURE.md](./ARCHITECTURE.md) for system design
- See [DEPLOYMENT.md](./DEPLOYMENT.md) for production deployment

## Testing Checklist

Before going live:
- [ ] Create a game
- [ ] Join a game (from different wallet)
- [ ] Play a full game
- [ ] Verify winner receives winnings
- [ ] Verify fee is collected
- [ ] Test game cancellation
- [ ] Check leaderboard stats

Happy gaming! 🎮



