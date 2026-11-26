// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";

/// @notice Testnet stand-in for a tokenized stock (bStock). Only its market mints and burns.
/// @dev Same behaviour as `contracts/src/stocks/MockBStock.sol` in the Foundry project; this copy lets the OpenFour
///      Hardhat project test on its own. On testnet both vaults can share the Foundry-deployed market.
contract MockBStock is ERC20 {
    address public immutable market;

    constructor(string memory name_, string memory symbol_, address market_) ERC20(name_, symbol_) {
        market = market_;
    }

    function mint(address to, uint256 amount) external {
        require(msg.sender == market, "MockBStock: only market");
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        require(msg.sender == market, "MockBStock: only market");
        _burn(from, amount);
    }
}

/// @notice Testnet stand-in for the DEX where bStocks trade: buys and sells them for BNB at owner-posted prices
///         (from the Atlas oracle). `priceWei` is BNB wei per 1e18 units.
contract MockStockMarket is Ownable {
    mapping(address => uint256) public priceWei;
    address[] public stocks;

    event Listed(address indexed stock, string symbol, uint256 priceWei);
    event PriceSet(address indexed stock, uint256 priceWei);
    event Bought(address indexed stock, address indexed to, uint256 paidWei, uint256 amount);
    event Sold(address indexed stock, address indexed from, uint256 amount, uint256 paidWei);

    constructor(address owner_) {
        _transferOwnership(owner_);
    }

    function list(string calldata name, string calldata symbol, uint256 price) external onlyOwner returns (address stock) {
        require(price > 0, "Market: zero price");
        stock = address(new MockBStock(name, symbol, address(this)));
        priceWei[stock] = price;
        stocks.push(stock);
        emit Listed(stock, symbol, price);
    }

    function setPrices(address[] calldata stocks_, uint256[] calldata prices) external onlyOwner {
        require(stocks_.length == prices.length, "Market: length mismatch");
        for (uint256 i; i < stocks_.length; ++i) {
            require(priceWei[stocks_[i]] > 0, "Market: not listed");
            require(prices[i] > 0, "Market: zero price");
            priceWei[stocks_[i]] = prices[i];
            emit PriceSet(stocks_[i], prices[i]);
        }
    }

    function stockCount() external view returns (uint256) {
        return stocks.length;
    }

    function buy(address stock, address to) external payable returns (uint256 amount) {
        uint256 price = priceWei[stock];
        require(price > 0, "Market: not listed");
        amount = msg.value * 1e18 / price;
        require(amount > 0, "Market: zero amount");
        MockBStock(stock).mint(to, amount);
        emit Bought(stock, to, msg.value, amount);
    }

    function sell(address stock, uint256 amount, address to) external returns (uint256 paid) {
        uint256 price = priceWei[stock];
        require(price > 0, "Market: not listed");
        paid = amount * price / 1e18;
        require(paid > 0, "Market: zero amount");
        MockBStock(stock).burn(msg.sender, amount);
        Address.sendValue(payable(to), paid);
        emit Sold(stock, msg.sender, amount, paid);
    }

    receive() external payable {}

    function withdraw(uint256 amount, address to) external onlyOwner {
        Address.sendValue(payable(to), amount);
    }
}
