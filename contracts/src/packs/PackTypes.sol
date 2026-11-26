// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice The stocks a coin's cards draw from.
/// @param market  The stock market the vault buys from. Must be the vault factory's market.
/// @param stocks  1 to 4 listed bStocks.
/// @param weights Draw weight of each stock in bps, summing to 10000.
struct PackBasket {
    address market;
    address[] stocks;
    uint16[] weights;
}

/// @notice The slice of `PackLauncher` the vault and its factory read.
interface IPackLauncher {
    function creator() external view returns (address);
    function name() external view returns (string memory);
    function quoteToken() external view returns (address);
    function packPrice() external view returns (uint256);
    function packsForSale() external view returns (uint256);
    function packsSold() external view returns (uint256);
    function packsOf(address account) external view returns (uint256);
    function launching() external view returns (bool);
}

/// @title PackOdds
/// @notice What a pack pays, as bps of the pack price. Each tier is ten equally likely outcomes.
///         - Low (0):    always 95%. The buyer's own payment covers it, so Low packs can always be bought.
///         - Medium (1): 30% to 150%, 90% on average.
///         - High (2):   10% to 300%, 90% on average.
///         Medium and High can be bought only while the pool can cover their top prize, so they unlock as it grows.
///         Presale packs use the Medium spread, scaled to their share of the presale reserve (see `PackVault`).
library PackOdds {
    uint8 internal constant LOW = 0;
    uint8 internal constant MEDIUM = 1;
    uint8 internal constant HIGH = 2;
    uint8 internal constant TIERS = 3;
    /// @dev Average of the Medium table, used to scale presale rolls to an average of 1x their share.
    uint16 internal constant MEDIUM_AVG_BPS = 9000;

    error BadTier(uint8 tier);

    function table(uint8 tier) internal pure returns (uint16[10] memory t) {
        if (tier == LOW) t = [uint16(9500), 9500, 9500, 9500, 9500, 9500, 9500, 9500, 9500, 9500];
        else if (tier == MEDIUM) t = [uint16(3000), 5000, 6000, 7000, 8000, 9000, 10000, 12000, 15000, 15000];
        else if (tier == HIGH) t = [uint16(1000), 2000, 3000, 4000, 5000, 6000, 8000, 10000, 21000, 30000];
        else revert BadTier(tier);
    }

    function maxBps(uint8 tier) internal pure returns (uint16) {
        return table(tier)[9];
    }

    function minBps(uint8 tier) internal pure returns (uint16) {
        return table(tier)[0];
    }

    function roll(uint8 tier, uint256 r) internal pure returns (uint16) {
        return table(tier)[r % 10];
    }
}
