// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "solady/auth/Ownable.sol";
import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";
import {MockBStock} from "./MockBStock.sol";

/// @notice What a pack vault needs from a stock market.
interface IStockMarket {
    function priceWei(address stock) external view returns (uint256);
    function buy(address stock, address to) external payable returns (uint256 amount);
}

/// @title MockStockMarket
/// @notice Testnet stand-in for the DEX where bStocks trade. It lists mock bStocks and buys and sells them for BNB at
///         prices the owner posts (from the Atlas oracle, off-chain). On mainnet the vault would swap into real bStocks
///         instead; nothing else changes.
/// @dev `priceWei(stock)` is BNB wei per 1e18 units (one whole bStock). Sells pay out of the BNB this market holds.
contract MockStockMarket is Ownable {
    using SafeTransferLib for address;

    mapping(address stock => uint256 price) public priceWei;
    address[] public stocks;

    error NotListed(address stock);
    error ZeroPrice();
    error LengthMismatch();
    error ZeroAmount();

    event Listed(address indexed stock, string symbol, uint256 priceWei);
    event PriceSet(address indexed stock, uint256 priceWei);
    event Bought(address indexed stock, address indexed to, uint256 paidWei, uint256 amount);
    event Sold(address indexed stock, address indexed from, uint256 amount, uint256 paidWei);

    constructor(address owner_) {
        _initializeOwner(owner_);
    }

    /// @notice Deploy and list a new mock bStock at `price`.
    function list(string calldata name, string calldata symbol, uint256 price) external onlyOwner returns (address stock) {
        if (price == 0) revert ZeroPrice();
        stock = address(new MockBStock(name, symbol, address(this)));
        priceWei[stock] = price;
        stocks.push(stock);
        emit Listed(stock, symbol, price);
    }

    /// @notice Post new prices.
    function setPrices(address[] calldata stocks_, uint256[] calldata prices) external onlyOwner {
        if (stocks_.length != prices.length) revert LengthMismatch();
        for (uint256 i; i < stocks_.length; ++i) {
            if (priceWei[stocks_[i]] == 0) revert NotListed(stocks_[i]);
            if (prices[i] == 0) revert ZeroPrice();
            priceWei[stocks_[i]] = prices[i];
            emit PriceSet(stocks_[i], prices[i]);
        }
    }

    function stockCount() external view returns (uint256) {
        return stocks.length;
    }

    /// @notice Spend `msg.value` BNB on `stock` for `to`.
    function buy(address stock, address to) external payable returns (uint256 amount) {
        uint256 price = priceWei[stock];
        if (price == 0) revert NotListed(stock);
        amount = msg.value * 1e18 / price;
        if (amount == 0) revert ZeroAmount();
        MockBStock(stock).mint(to, amount);
        emit Bought(stock, to, msg.value, amount);
    }

    /// @notice Sell `amount` of the caller's `stock` for BNB, paid to `to`.
    function sell(address stock, uint256 amount, address to) external returns (uint256 paid) {
        uint256 price = priceWei[stock];
        if (price == 0) revert NotListed(stock);
        paid = amount * price / 1e18;
        if (paid == 0) revert ZeroAmount();
        MockBStock(stock).burn(msg.sender, amount);
        to.safeTransferETH(paid);
        emit Sold(stock, msg.sender, amount, paid);
    }

    /// @notice Top up the BNB that pays for sells.
    receive() external payable {}

    /// @notice Testnet only: take back BNB the market holds.
    function withdraw(uint256 amount, address to) external onlyOwner {
        to.safeTransferETH(amount);
    }
}
