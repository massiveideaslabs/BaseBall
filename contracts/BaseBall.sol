// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract BaseBall {
    struct Game {
        address host;
        address player;
        uint256 wager;
        uint8 difficulty;
        GameStatus status;
        uint256 gameId;
        uint256 createdAt;
        uint256 expiresAt;
    }

    enum GameStatus {
        Pending,
        Active,
        Completed,
        Cancelled
    }

    struct PlayerStats {
        uint256 wins;
        uint256 totalWinnings;
        uint256 gamesPlayed;
    }

    mapping(uint256 => Game) public games;
    mapping(address => PlayerStats) public playerStats;
    mapping(address => uint256[]) public playerGames;

    uint256 public gameCounter;
    uint256 public constant FEE_PERCENTAGE = 100; // 1% (in basis points)
    address public feeWallet;
    address public owner;

    event GameCreated(uint256 indexed gameId, address indexed host, uint256 wager, uint8 difficulty);
    event GameJoined(uint256 indexed gameId, address indexed player);
    event GameCancelled(uint256 indexed gameId, address indexed host);
    event GameCompleted(uint256 indexed gameId, address indexed winner, uint256 winnings);
    event WagerDeposited(uint256 indexed gameId, address indexed player, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address _feeWallet) {
        owner = msg.sender;
        feeWallet = _feeWallet;
        gameCounter = 0;
    }

    function createGame(uint8 difficulty, uint256 expirationDuration) external payable returns (uint256) {
        require(msg.value > 0, "Wager must be greater than 0");
        require(difficulty >= 1 && difficulty <= 10, "Difficulty must be between 1 and 10");
        require(expirationDuration > 0, "Expiration duration must be greater than 0");
        require(expirationDuration <= 7 days, "Expiration duration cannot exceed 7 days");

        gameCounter++;
        uint256 gameId = gameCounter;

        games[gameId] = Game({
            host: msg.sender,
            player: address(0),
            wager: msg.value,
            difficulty: difficulty,
            status: GameStatus.Pending,
            gameId: gameId,
            createdAt: block.timestamp,
            expiresAt: block.timestamp + expirationDuration
        });

        playerGames[msg.sender].push(gameId);

        emit GameCreated(gameId, msg.sender, msg.value, difficulty);
        emit WagerDeposited(gameId, msg.sender, msg.value);

        return gameId;
    }

    function joinGame(uint256 gameId) external payable {
        Game storage game = games[gameId];
        require(game.status == GameStatus.Pending, "Game not available");
        require(game.host != msg.sender, "Cannot join your own game");
        require(msg.value == game.wager, "Wager must match");
        require(block.timestamp < game.expiresAt, "Game has expired");

        game.player = msg.sender;
        game.status = GameStatus.Active;

        playerGames[msg.sender].push(gameId);
        playerStats[msg.sender].gamesPlayed++;

        emit GameJoined(gameId, msg.sender);
        emit WagerDeposited(gameId, msg.sender, msg.value);
    }

    function cancelGame(uint256 gameId) external {
        Game storage game = games[gameId];
        require(game.status == GameStatus.Pending, "Game not cancellable");
        require(game.host == msg.sender, "Only host can cancel");

        game.status = GameStatus.Cancelled;

        // Refund host
        (bool success, ) = payable(game.host).call{value: game.wager}("");
        require(success, "Refund failed");

        emit GameCancelled(gameId, msg.sender);
    }
    
    // Public function to cancel expired games (anyone can call this)
    function cancelExpiredGame(uint256 gameId) external {
        Game storage game = games[gameId];
        require(game.status == GameStatus.Pending, "Game not pending");
        require(block.timestamp >= game.expiresAt, "Game has not expired yet");

        game.status = GameStatus.Cancelled;

        // Refund host
        (bool success, ) = payable(game.host).call{value: game.wager}("");
        require(success, "Refund failed");

        emit GameCancelled(gameId, game.host);
    }

    // Note: In production, consider adding a commit-reveal scheme or oracle
    // to prevent players from submitting false winners. Current implementation
    // relies on frontend validation and player honesty.
    function completeGame(uint256 gameId, address winner) external {
        Game storage game = games[gameId];
        require(game.status == GameStatus.Active, "Game not active");
        require(
            msg.sender == game.host || msg.sender == game.player,
            "Only game participants can complete game"
        );
        require(
            winner == game.host || winner == game.player,
            "Winner must be a player"
        );

        game.status = GameStatus.Completed;

        uint256 totalPot = game.wager * 2;
        uint256 fee = (totalPot * FEE_PERCENTAGE) / 10000;
        uint256 winnings = totalPot - fee;

        // Update stats
        playerStats[winner].wins++;
        playerStats[winner].totalWinnings += winnings;
        if (game.host == winner) {
            playerStats[game.host].gamesPlayed++;
        } else {
            playerStats[game.player].gamesPlayed++;
        }

        // Send fee to fee wallet
        if (fee > 0) {
            (bool feeSuccess, ) = payable(feeWallet).call{value: fee}("");
            require(feeSuccess, "Fee transfer failed");
        }

        // Send winnings to winner
        (bool winSuccess, ) = payable(winner).call{value: winnings}("");
        require(winSuccess, "Winnings transfer failed");

        emit GameCompleted(gameId, winner, winnings);
    }

    function getGame(uint256 gameId) external view returns (Game memory) {
        return games[gameId];
    }

    function getPlayerStats(address player) external view returns (PlayerStats memory) {
        return playerStats[player];
    }

    function getPlayerGames(address player) external view returns (uint256[] memory) {
        return playerGames[player];
    }

    function getAllPendingGames() external view returns (Game[] memory) {
        uint256 count = 0;
        for (uint256 i = 1; i <= gameCounter; i++) {
            if (games[i].status == GameStatus.Pending) {
                count++;
            }
        }

        Game[] memory pendingGames = new Game[](count);
        uint256 index = 0;
        for (uint256 i = 1; i <= gameCounter; i++) {
            if (games[i].status == GameStatus.Pending) {
                pendingGames[index] = games[i];
                index++;
            }
        }
        return pendingGames;
    }

    function getTopPlayersByWins(uint256 limit) external view returns (address[] memory, uint256[] memory) {
        address[] memory topAddresses = new address[](limit);
        uint256[] memory topWins = new uint256[](limit);

        // This is a simplified version - in production, you'd want to maintain a sorted list
        // For now, we'll return empty arrays as this requires off-chain indexing
        return (topAddresses, topWins);
    }

    function getTopPlayersByWinnings(uint256 limit) external view returns (address[] memory, uint256[] memory) {
        address[] memory topAddresses = new address[](limit);
        uint256[] memory topWinnings = new uint256[](limit);

        // This is a simplified version - in production, you'd want to maintain a sorted list
        // For now, we'll return empty arrays as this requires off-chain indexing
        return (topAddresses, topWinnings);
    }

    function setFeeWallet(address _feeWallet) external onlyOwner {
        require(_feeWallet != address(0), "Invalid address");
        feeWallet = _feeWallet;
    }
}

