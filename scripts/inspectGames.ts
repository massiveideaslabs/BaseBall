import hre from "hardhat";

async function main() {
  const { ethers } = hre;
  const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  if (!contractAddress) {
    throw new Error("NEXT_PUBLIC_CONTRACT_ADDRESS not set");
  }

  const BaseBall = await ethers.getContractFactory("BaseBall");
  const contract = BaseBall.attach(contractAddress);

  const gameCounter = await contract.gameCounter();
  console.log("gameCounter:", gameCounter.toString());

  for (let i = 1; i <= Number(gameCounter); i++) {
    const game = await contract.games(i);
    console.log(`Game ${i}:`, {
      host: game.host,
      player: game.player,
      wager: ethers.formatEther(game.wager),
      difficulty: game.difficulty,
      status: game.status,
    });
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

