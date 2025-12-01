import hre from "hardhat";
const { ethers } = hre;

async function main() {
  const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  if (!contractAddress) {
    console.error("NEXT_PUBLIC_CONTRACT_ADDRESS not set in .env");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org");
  const contract = await ethers.getContractAt("BaseBall", contractAddress, provider);

  console.log("Checking contract balance...");
  const contractBalance = await provider.getBalance(contractAddress);
  console.log(`Contract balance: ${ethers.formatEther(contractBalance)} ETH`);

  // Get recent GameCancelled events
  console.log("\nChecking recent GameCancelled events...");
  const filter = contract.filters.GameCancelled();
  const events = await contract.queryFilter(filter, -1000); // Last 1000 blocks
  
  if (events.length > 0) {
    console.log(`\nFound ${events.length} cancellation event(s):`);
    events.slice(-5).forEach((event, i) => {
      console.log(`\nEvent ${i + 1}:`);
      console.log(`  Game ID: ${event.args.gameId}`);
      console.log(`  Host: ${event.args.host}`);
      console.log(`  Block: ${event.blockNumber}`);
      console.log(`  Transaction: ${event.transactionHash}`);
      console.log(`  View on BaseScan: https://sepolia.basescan.org/tx/${event.transactionHash}`);
    });
  } else {
    console.log("No cancellation events found in recent blocks.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

