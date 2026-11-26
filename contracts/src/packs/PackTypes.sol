// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice The stocks a coin's packs draw from.
/// @param market  The stock market the vault buys from. Must be the vault factory's market.
/// @param stocks  1 to 4 listed bStocks.
/// @param weights Draw weight of each stock in bps, summing to 10000.
/// @param style   Risk style: 0 Steady, 1 Classic, 2 Moonshot (see `PackOdds`).
struct PackBasket {
    address market;
    address[] stocks;
    uint16[] weights;
    uint8 style;
}

/// @notice The slice of `PackLauncher` the vault and its factory read.
interface IPackLauncher {
    function creator() external view returns (address);
    function name() external view returns (string memory);
    function packPrice() external view returns (uint256);
    function packsForSale() external view returns (uint256);
    function packsSold() external view returns (uint256);
    function packsOf(address account) external view returns (uint256);
    function launching() external view returns (bool);
}

/// @title PackOdds
/// @notice What a pack can pay, as bps of the pack price. Each style is ten equally likely outcomes that average 90%
///         of the price, so the pool keeps 10% of every pack sold on average. Riskier styles spread the same average
///         wider.
library PackOdds {
    uint8 internal constant STYLES = 3;

    error BadStyle(uint8 style);

    function table(uint8 style) internal pure returns (uint16[10] memory t) {
        if (style == 0) t = [uint16(6000), 7000, 8000, 8000, 9000, 9000, 10000, 10000, 11000, 12000];
        else if (style == 1) t = [uint16(3000), 5000, 6000, 7000, 8000, 9000, 10000, 12000, 15000, 15000];
        else if (style == 2) t = [uint16(1000), 2000, 3000, 4000, 5000, 6000, 8000, 10000, 21000, 30000];
        else revert BadStyle(style);
    }

    /// @notice The top prize: what the pool must hold before a pack may open.
    function maxBps(uint8 style) internal pure returns (uint16) {
        return table(style)[9];
    }

    /// @notice The lowest prize, used when a reveal comes too late to read its block hash.
    function minBps(uint8 style) internal pure returns (uint16) {
        return table(style)[0];
    }

    /// @notice The outcome for a uniform random `r`.
    function roll(uint8 style, uint256 r) internal pure returns (uint16) {
        return table(style)[r % 10];
    }
}
