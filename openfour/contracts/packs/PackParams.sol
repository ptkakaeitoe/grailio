// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice `PackMigrateModule` init params. Flat (no arrays) so OpenFour's schema-driven create form can encode it.
/// @param softCap        Raise that lets the sale migrate early. Zero disables it.
/// @param duration       Seconds until the sale may migrate anyway.
/// @param tokenLiquidityAmount Tokens into the PCS pair. Zero means `maxSupply - sold`.
/// @param stockPoolBps   Share of the raise sent to the coin's pack vault at migration (0-5000); the rest is LP.
/// @param packPrice      BNB per pack bought from the vault after launch.
/// @param tokensPerPack  Tokens bought in the inner market that earn one presale pack.
/// @param style          0 Steady, 1 Classic, 2 Moonshot.
/// @param stock0..3      Up to four bStocks (zero = unused; used ones first).
/// @param weight0..3     Draw weight of each stock in bps, summing to 10000.
struct PackInputParams {
    uint256 softCap;
    uint256 duration;
    uint256 tokenLiquidityAmount;
    uint16 stockPoolBps;
    uint256 packPrice;
    uint256 tokensPerPack;
    uint8 style;
    address stock0;
    address stock1;
    address stock2;
    address stock3;
    uint16 weight0;
    uint16 weight1;
    uint16 weight2;
    uint16 weight3;
}

library PackParams {
    uint16 internal constant MAX_STOCK_POOL_BPS = 5000;

    /// @notice The used stocks and weights, in order. Reverts on gaps, zero weights or a bad total.
    function basket(PackInputParams memory p) internal pure returns (address[] memory stocks, uint16[] memory weights) {
        address[4] memory s = [p.stock0, p.stock1, p.stock2, p.stock3];
        uint16[4] memory w = [p.weight0, p.weight1, p.weight2, p.weight3];
        uint256 n;
        while (n < 4 && s[n] != address(0)) ++n;
        require(n > 0, "PackParams: no stocks");
        stocks = new address[](n);
        weights = new uint16[](n);
        uint256 total;
        for (uint256 i; i < 4; ++i) {
            if (i >= n) {
                require(s[i] == address(0) && w[i] == 0, "PackParams: gap in basket");
                continue;
            }
            require(w[i] > 0, "PackParams: zero weight");
            for (uint256 j; j < i; ++j) require(s[j] != s[i], "PackParams: duplicate stock");
            stocks[i] = s[i];
            weights[i] = w[i];
            total += w[i];
        }
        require(total == 10_000, "PackParams: weights must sum to 10000");
    }
}
