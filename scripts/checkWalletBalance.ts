import hre from "hardhat";
const { ethers } = hre;

async function main() {
  const walletAddress = "0xdFDB590647C98E10a0AC80FC57da6553450BDA5D";
  const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org");

  console.log(`Checking balance for wallet: ${walletAddress}\n`);
  
  const balance = await provider.getBalance(walletAddress);
  console.log(`Current Balance: ${ethers.formatEther(balance)} ETH`);
  
  // Get recent transactions
  console.log("\nFetching recent transaction history...");
  console.log(`View on BaseScan: https://sepolia.basescan.org/address/${walletAddress}`);
  
  // Check the cancellation transaction
  const txHash = "0x9742d5435d5a02d27d38f710d0acf712963b94b52b2d1c056dffa1d141e271a2";
  const tx = await provider.getTransaction(txHash);
  const receipt = await provider.getTransactionReceipt(txHash);
  
  if (receipt) {
    console.log(`\nCancellation Transaction Details:`);
    console.log(`  Status: ${receipt.status === 1 ? 'Success' : 'Failed'}`);
    console.log(`  Gas Used: ${receipt.gasUsed.toString()}`);
    console.log(`  Block: ${receipt.blockNumber}`);
    
    // Check logs for GameCancelled event
    const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
    if (contractAddress) {
      const contract = await ethers.getContractAt("BaseBall", contractAddress, provider);
      const iface = contract.interface;
      
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog(log);
          if (parsed && parsed.name === "GameCancelled") {
            console.log(`\n  GameCancelled Event Found:`);
            console.log(`    Game ID: ${parsed.args.gameId.toString()}`);
            console.log(`    Host: ${parsed.args.host}`);
          }
        } catch (e) {
          // Not our event, skip
        }
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

