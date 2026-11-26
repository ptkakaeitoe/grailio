// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ITestStockMarket} from "./MarketV2Router.sol";

/// @title MarketPriceFeed (BSC testnet only)
/// @notice Chainlink-style USD price for one test stock, read from the testnet trade market: the price its keeper
///         last posted (from Atlas) and when. 18 decimals. CollectPacks checks fills against it, so a card gets
///         exactly what MarketV2Router buys.
contract MarketPriceFeed {
    ITestStockMarket public immutable market;
    address public immutable stock;
    string public description;

    constructor(ITestStockMarket market_, address stock_, string memory description_) {
        market = market_;
        stock = stock_;
        description = description_;
    }

    function decimals() external pure returns (uint8) {
        return 18;
    }

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        uint256 at = market.priceAt(stock);
        return (1, int256(market.usdPrice(stock)), at, at, 1);
    }
}
