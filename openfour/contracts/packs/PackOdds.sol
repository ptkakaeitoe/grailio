// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice What a stock market must offer a pack vault. On testnet this is Grailio's MockStockMarket.
interface IStockMarket {
    function priceWei(address stock) external view returns (uint256);
    function buy(address stock, address to) external payable returns (uint256 amount);
}

/// @title PackOdds
/// @notice What a pack can pay, as bps of the pack price. Same tables as the Flap PackVault: ten equally likely
///         outcomes averaging 90% of the price; riskier styles spread the same average wider.
library PackOdds {
    uint8 internal constant STYLES = 3;

    function table(uint8 style) internal pure returns (uint16[10] memory t) {
        if (style == 0) t = [uint16(6000), 7000, 8000, 8000, 9000, 9000, 10000, 10000, 11000, 12000];
        else if (style == 1) t = [uint16(3000), 5000, 6000, 7000, 8000, 9000, 10000, 12000, 15000, 15000];
        else if (style == 2) t = [uint16(1000), 2000, 3000, 4000, 5000, 6000, 8000, 10000, 21000, 30000];
        else revert("PackOdds: bad style");
    }

    function maxBps(uint8 style) internal pure returns (uint16) {
        return table(style)[9];
    }

    function minBps(uint8 style) internal pure returns (uint16) {
        return table(style)[0];
    }

    function roll(uint8 style, uint256 r) internal pure returns (uint16) {
        return table(style)[r % 10];
    }
}
