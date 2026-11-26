// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// What the router needs from the testnet trade market (MockStockMarket in the testnet repo).
interface ITestStockMarket {
    function buyWith(address stock, address quote, uint256 amount, address to) external returns (uint256 stockAmount);
    function usdPrice(address stock) external view returns (uint256);
    function priceAt(address stock) external view returns (uint256);
}

/// @title MarketV2Router (BSC testnet only)
/// @notice Lets CollectPacks fill cards on testnet, where bStocks have no DEX pools: it speaks the v2 router call
///         CollectPacks makes (`swapExactTokensForTokens`, path [payToken, stock]) and buys the stock from the
///         testnet trade market at its posted price instead. Holds nothing between calls.
contract MarketV2Router {
    using SafeERC20 for IERC20;

    ITestStockMarket public immutable market;

    error BadPath();
    error Expired();
    error InsufficientOutput(uint256 out, uint256 min);

    constructor(ITestStockMarket market_) {
        market = market_;
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts) {
        if (path.length != 2) revert BadPath();
        if (block.timestamp > deadline) revert Expired();
        IERC20 payToken = IERC20(path[0]);
        payToken.safeTransferFrom(msg.sender, address(this), amountIn);
        payToken.forceApprove(address(market), amountIn);
        uint256 out = market.buyWith(path[1], path[0], amountIn, to);
        payToken.forceApprove(address(market), 0);
        if (out < amountOutMin) revert InsufficientOutput(out, amountOutMin);
        amounts = new uint256[](2);
        amounts[0] = amountIn;
        amounts[1] = out;
    }
}
