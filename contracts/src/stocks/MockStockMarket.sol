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

/// @notice Chainlink-style price feed. Atlas's on-chain feeds ("SingleFeed BNB/USD") expose this interface.
interface IPriceFeed {
    function decimals() external view returns (uint8);
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

/// @title MockStockMarket
/// @notice Testnet stand-in for the DEX where bStocks trade. It lists mock bStocks and buys and sells them for BNB.
///         Each stock has a USD price, posted by the owner from the Atlas oracle's signed stock prices; the BNB side
///         is read live from Atlas's on-chain BNB/USD feed. So a stock's price in BNB moves with BNB on every call.
///         On mainnet the vault would swap into real bStocks instead; nothing else changes.
/// @dev `usdPrice` is USD per whole bStock with 18 decimals. `priceWei` is BNB wei per 1e18 units of the stock.
contract MockStockMarket is Ownable {
    using SafeTransferLib for address;

    /// @notice Atlas BNB/USD feed.
    IPriceFeed public immutable bnbUsdFeed;
    uint256 internal immutable _feedScale;

    mapping(address stock => uint256 usd) public usdPrice;
    address[] public stocks;

    error NotListed(address stock);
    error ZeroPrice();
    error LengthMismatch();
    error ZeroAmount();
    error BadFeed();

    event Listed(address indexed stock, string symbol, uint256 usdPrice);
    event PriceSet(address indexed stock, uint256 usdPrice);
    event Bought(address indexed stock, address indexed to, uint256 paidWei, uint256 amount);
    event Sold(address indexed stock, address indexed from, uint256 amount, uint256 paidWei);

    constructor(address owner_, address bnbUsdFeed_) {
        _initializeOwner(owner_);
        bnbUsdFeed = IPriceFeed(bnbUsdFeed_);
        uint8 d = IPriceFeed(bnbUsdFeed_).decimals();
        if (d > 36) revert BadFeed();
        _feedScale = 10 ** uint256(d);
    }

    /// @notice BNB/USD from Atlas, 18 decimals.
    function bnbUsd() public view returns (uint256) {
        (, int256 answer,,,) = bnbUsdFeed.latestRoundData();
        if (answer <= 0) revert BadFeed();
        return uint256(answer) * 1e18 / _feedScale;
    }

    /// @notice BNB wei per whole bStock, at the posted USD price and the live BNB/USD.
    function priceWei(address stock) public view returns (uint256) {
        uint256 usd = usdPrice[stock];
        if (usd == 0) return 0;
        return usd * 1e18 / bnbUsd();
    }

    /// @notice Deploy and list a new mock bStock at a USD price (18 decimals).
    function list(string calldata name, string calldata symbol, uint256 usd) external onlyOwner returns (address stock) {
        if (usd == 0) revert ZeroPrice();
        stock = address(new MockBStock(name, symbol, address(this)));
        usdPrice[stock] = usd;
        stocks.push(stock);
        emit Listed(stock, symbol, usd);
    }

    /// @notice Post new USD prices (18 decimals), from Atlas.
    function setUsdPrices(address[] calldata stocks_, uint256[] calldata usd) external onlyOwner {
        if (stocks_.length != usd.length) revert LengthMismatch();
        for (uint256 i; i < stocks_.length; ++i) {
            if (usdPrice[stocks_[i]] == 0) revert NotListed(stocks_[i]);
            if (usd[i] == 0) revert ZeroPrice();
            usdPrice[stocks_[i]] = usd[i];
            emit PriceSet(stocks_[i], usd[i]);
        }
    }

    function stockCount() external view returns (uint256) {
        return stocks.length;
    }

    /// @notice Spend `msg.value` BNB on `stock` for `to`.
    function buy(address stock, address to) external payable returns (uint256 amount) {
        uint256 price = priceWei(stock);
        if (price == 0) revert NotListed(stock);
        amount = msg.value * 1e18 / price;
        if (amount == 0) revert ZeroAmount();
        MockBStock(stock).mint(to, amount);
        emit Bought(stock, to, msg.value, amount);
    }

    /// @notice Sell `amount` of the caller's `stock` for BNB, paid to `to` from the BNB this market holds.
    function sell(address stock, uint256 amount, address to) external returns (uint256 paid) {
        uint256 price = priceWei(stock);
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
