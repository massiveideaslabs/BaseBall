// This script generates the ABI file from the compiled contract
// Run: npx ts-node scripts/generateABI.ts

import fs from 'fs'
import path from 'path'

async function generateABI() {
  try {
    const artifactPath = path.join(__dirname, '../artifacts/contracts/BaseBall.sol/BaseBall.json')
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf-8'))
    
    const abiPath = path.join(__dirname, '../lib/BaseBallABI.json')
    fs.writeFileSync(abiPath, JSON.stringify(artifact.abi, null, 2))
    
    console.log('ABI generated successfully!')
  } catch (error) {
    console.error('Error generating ABI:', error)
    console.log('Make sure to compile contracts first: npm run compile')
  }
}

generateABI()



