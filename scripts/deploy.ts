import hre from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const feeWallet = process.env.FEE_WALLET_ADDRESS;
  if (!feeWallet) {
    throw new Error("FEE_WALLET_ADDRESS not set in environment variables");
  }

  console.log("Deploying BaseBall contract...");
  console.log("Fee wallet:", feeWallet);

  const signers = await hre.ethers.getSigners();
  console.log("Available signers:", signers.length);
  if (signers.length === 0) {
    throw new Error("No signers available. Check your PRIVATE_KEY in .env file.");
  }
  const deployer = signers[0];
  console.log("Deploying with account:", deployer.address);

  const BaseBall = await hre.ethers.getContractFactory("BaseBall");
  const baseBall = await BaseBall.connect(deployer).deploy(feeWallet);

  await baseBall.waitForDeployment();

  const address = await baseBall.getAddress();
  console.log("BaseBall deployed to:", address);
  console.log("\nPlease update your .env file with:");
  console.log(`NEXT_PUBLIC_CONTRACT_ADDRESS=${address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

