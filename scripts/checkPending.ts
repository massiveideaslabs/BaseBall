import hre from "hardhat";

async function main() {
  const { ethers } = hre;
  const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  if (!contractAddress) {
    throw new Error("NEXT_PUBLIC_CONTRACT_ADDRESS is not set in .env");
  }

  const BaseBall = await ethers.getContractFactory("BaseBall");
  const contract = BaseBall.attach(contractAddress);

  const pendingGames = await contract.getAllPendingGames();

  console.log(`Found ${pendingGames.length} pending game(s):`);

  pendingGames.forEach((game: any) => {
    console.log({
      gameId: game.gameId.toString(),
      host: game.host,
      player: game.player,
      wager: ethers.formatEther(game.wager),
      difficulty: game.difficulty,
      status: game.status,
      createdAt: game.createdAt?.toString?.() ?? game.createdAt,
    });
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

