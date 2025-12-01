# Deployment Guide

## Smart Contract Deployment

### 1. Prepare Environment

Ensure you have:
- A wallet with ETH on Base network for gas fees
- Your fee wallet address (to receive 1% fees)
- Base RPC URL

### 2. Configure Environment Variables

```bash
PRIVATE_KEY=your_deployment_wallet_private_key
FEE_WALLET_ADDRESS=your_fee_wallet_address
BASE_RPC_URL=https://mainnet.base.org
BASESCAN_API_KEY=your_basescan_api_key (optional, for verification)
```

### 3. Deploy Contract

```bash
npm run compile
npm run deploy:base
```

### 4. Verify Contract (Optional)

After deployment, verify on BaseScan:
```bash
npx hardhat verify --network base <CONTRACT_ADDRESS> <FEE_WALLET_ADDRESS>
```

### 5. Update Frontend

Add the deployed contract address to `.env`:
```
NEXT_PUBLIC_CONTRACT_ADDRESS=<deployed_contract_address>
```

## Frontend Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables:
   - `NEXT_PUBLIC_CONTRACT_ADDRESS`
   - `NEXT_PUBLIC_GAME_SERVER_URL` (your game server URL)
4. Deploy

### Other Platforms

The Next.js app can be deployed to any platform supporting Node.js:
- Netlify
- AWS Amplify
- Railway
- Your own server

## Game Server Deployment

### Railway/Render

1. Connect your repository
2. Set root directory to `server/`
3. Add environment variable:
   - `CLIENT_URL`: Your frontend URL
   - `PORT`: 3001 (or your chosen port)
4. Deploy

### Self-Hosted

```bash
cd server
npm install
npm start
```

Ensure the server is accessible from your frontend domain.

## Network Configuration

### Base Mainnet
- Chain ID: 8453
- RPC: https://mainnet.base.org
- Explorer: https://basescan.org

### Base Sepolia (Testnet)
- Chain ID: 84532
- RPC: https://sepolia.base.org
- Explorer: https://sepolia.basescan.org

## Post-Deployment Checklist

- [ ] Contract deployed and verified
- [ ] Contract address added to frontend `.env`
- [ ] Frontend deployed and accessible
- [ ] Game server deployed and accessible
- [ ] Wallet connection working
- [ ] Test game creation
- [ ] Test game joining
- [ ] Test game completion
- [ ] Verify fee collection
- [ ] Test on multiple browsers/devices

## Monitoring

Consider setting up:
- Contract event monitoring for game events
- Error tracking (Sentry, etc.)
- Analytics for game activity
- Server uptime monitoring



