# Deploy Base Ball Online - Step by Step Guide

This guide will help you deploy Base Ball so you can test multiplayer functionality online.

## Prerequisites

- GitHub account
- Vercel account (free) - for frontend
- Railway or Render account (free tier available) - for game server
- Your contract is already deployed to Base Sepolia (✅ Done: `0xF9b5a04695cbd9586D0409bA5627bCd0497c535E`)

## Step 1: Push Code to GitHub

1. Create a new repository on GitHub (make it private if you want)
2. Push your code:

```bash
cd /Users/andersscherberger/.cursor/worktrees/Base_Ball/gxv
git init
git add .
git commit -m "Initial commit - Base Ball game"
git branch -M main
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

**Important:** Make sure `.env` is in `.gitignore` (it should be already)

## Step 2: Deploy Game Server (Railway - Recommended)

### Option A: Railway (Easier, Free Tier Available)

1. Go to [railway.app](https://railway.app) and sign up/login
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. **Important:** Click "Add Service" → "Empty Service"
5. In the service settings:
   - **Root Directory:** Set to `server`
   - **Start Command:** `npm start`
6. Go to "Variables" tab and add:
   - `CLIENT_URL` = `https://your-frontend-url.vercel.app` (we'll update this after frontend deploys)
   - `PORT` = `3001` (optional, defaults to 3001)
7. Click "Deploy"
8. Once deployed, copy the **public URL** (e.g., `https://your-app.railway.app`)

### Option B: Render (Alternative)

1. Go to [render.com](https://render.com) and sign up
2. Click "New" → "Web Service"
3. Connect your GitHub repo
4. Settings:
   - **Name:** base-ball-server
   - **Root Directory:** `server`
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Add environment variables:
   - `CLIENT_URL` = `https://your-frontend-url.vercel.app`
   - `PORT` = `3001`
6. Click "Create Web Service"
7. Copy the service URL

## Step 3: Deploy Frontend (Vercel)

1. Go to [vercel.com](https://vercel.com) and sign up/login with GitHub
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. Configure:
   - **Framework Preset:** Next.js (auto-detected)
   - **Root Directory:** `./` (root)
5. Add Environment Variables:
   - `NEXT_PUBLIC_CONTRACT_ADDRESS` = `0xF9b5a04695cbd9586D0409bA5627bCd0497c535E`
   - `NEXT_PUBLIC_GAME_SERVER_URL` = `https://your-server-url.railway.app` (from Step 2)
6. Click "Deploy"
7. Wait for deployment (usually 2-3 minutes)
8. Copy your frontend URL (e.g., `https://base-ball.vercel.app`)

## Step 4: Update Game Server with Frontend URL

1. Go back to Railway/Render
2. Update the `CLIENT_URL` environment variable to your Vercel URL
3. Redeploy the service (Railway auto-redeploys, Render may need manual restart)

## Step 5: Test Everything

1. Visit your Vercel URL
2. Connect wallet (MetaMask on Base Sepolia)
3. Create a test game
4. Have a friend join from their computer
5. Play and test!

## Quick Reference

### Your Current Setup:
- **Contract Address (Base Sepolia):** `0xF9b5a04695cbd9586D0409bA5627bCd0497c535E`
- **Fee Wallet:** `0xdFDB590647C98E10a0AC80FC57da6553450BDA5D`

### Environment Variables Needed:

**Frontend (Vercel):**
- `NEXT_PUBLIC_CONTRACT_ADDRESS` = `0xF9b5a04695cbd9586D0409bA5627bCd0497c535E`
- `NEXT_PUBLIC_GAME_SERVER_URL` = `https://your-server-url.railway.app`

**Game Server (Railway/Render):**
- `CLIENT_URL` = `https://your-frontend-url.vercel.app`
- `PORT` = `3001` (optional)

## Troubleshooting

### Frontend can't connect to game server
- Check CORS settings in `server/index.js`
- Verify `CLIENT_URL` matches your frontend URL exactly
- Check server logs for connection errors

### Wallet connection issues
- Make sure users have Base Sepolia network added
- Check browser console for errors

### Games not appearing
- Verify contract address is correct
- Check network (should be Base Sepolia)
- Look at browser console for contract errors

## Next Steps After Deployment

1. Test with a friend on different networks
2. Monitor server logs for errors
3. Test game creation, joining, and completion
4. Verify winnings are distributed correctly
5. Check fee collection

