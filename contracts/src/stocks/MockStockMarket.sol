// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "solady/auth/Ownable.sol";
import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";
import {MockBStock} from "./MockBStock.sol";

/// @notice What a pack vault needs from a stock market. `quote` is address(0) for native BNB or an ERC20.
interface IStockMarket {
    /// @notice Quote units per whole bStock (1e18 units). 0 when the stock or quote isn't supported.
    function priceIn(address stock, address quote) external view returns (uint256);
    /// @notice Whether `quote` can pay for stocks here.
    function isQuote(address quote) external view returns (bool);
    /// @notice Spend `msg.value` BNB on `stock` for `to`.
    function buy(address stock, address to) external payable returns (uint256 amount);
    /// @notice Spend `amount` of an ERC20 quote (pulled from the caller) on `stock` for `to`.
    function buyWith(address stock, address quote, uint256 amount, address to) external returns (uint256 stockAmount);
}

/// @notice A test token anyone (here: the market) can mint, like Flap's testnet USD.
interface IMintable {
    function mint(address to, uint256 amount) external;
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
/// @notice Testnet stand-in for the DEX where bStocks trade. Each stock has a USD price posted by the owner from the
///         Atlas oracle's signed stock prices. Stocks can be bought with native BNB (converted live with Atlas's
///         on-chain BNB/USD feed) or with an ERC20 quote the owner registered with its USD price (for example Flap's
///         testnet USD at $1). On mainnet the vault would swap into real bStocks instead.
///         Selling pays BNB from the market's own balance, or a mintable quote (Flap's testnet USD), which the market
///         mints, so sells never run dry. A keeper may post prices (and nothing else), so a hot key on a server can keep
///         them fresh without owning the market.
/// @dev Prices are 18-decimal USD. ERC20 quotes are assumed to have 18 decimals.
contract MockStockMarket is Ownable {
    using SafeTransferLib for address;

    /// @notice Atlas BNB/USD feed.
    IPriceFeed public immutable bnbUsdFeed;
    uint256 internal immutable _feedScale;

    mapping(address stock => uint256 usd) public usdPrice;
    /// @notice When each stock's price was last set (unix seconds).
    mapping(address stock => uint256 at) public priceAt;
    /// @notice Quotes the market may mint to pay sellers (free-mint test tokens only).
    mapping(address quote => bool) public mintableQuote;
    /// @notice May post prices, like the owner, but can do nothing else.
    address public keeper;
    /// @notice USD price of one whole unit of a registered ERC20 quote (18 decimals). 0 = not a quote.
    mapping(address quote => uint256 usd) public quoteUsd;
    address[] public stocks;

    error NotListed(address stock);
    error NotQuote(address quote);
    error ZeroPrice();
    error LengthMismatch();
    error ZeroAmount();
    error BadFeed();
    error NotPriceSetter();

    event Listed(address indexed stock, string symbol, uint256 usdPrice);
    event PriceSet(address indexed stock, uint256 usdPrice);
    event QuoteSet(address indexed quote, uint256 usdPrice);
    event Bought(address indexed stock, address indexed quote, address indexed to, uint256 paid, uint256 amount);
    event Sold(address indexed stock, address indexed quote, address indexed from, uint256 amount, uint256 paid);
    event KeeperSet(address indexed keeper);
    event MintableQuoteSet(address indexed quote, bool mintable);

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

    function isQuote(address quote) public view returns (bool) {
        return quote == address(0) || quoteUsd[quote] != 0;
    }

    /// @notice Quote units per whole bStock: the stock's USD price over the quote's USD price.
    function priceIn(address stock, address quote) public view returns (uint256) {
        uint256 usd = usdPrice[stock];
        if (usd == 0 || !isQuote(quote)) return 0;
        uint256 q = quote == address(0) ? bnbUsd() : quoteUsd[quote];
        return usd * 1e18 / q;
    }

    /// @notice BNB wei per whole bStock (kept for the app and older callers).
    function priceWei(address stock) external view returns (uint256) {
        return priceIn(stock, address(0));
    }

    /// @notice Deploy and list a new mock bStock at a USD price (18 decimals).
    function list(string calldata name, string calldata symbol, uint256 usd) external onlyOwner returns (address stock) {
        if (usd == 0) revert ZeroPrice();
        stock = address(new MockBStock(name, symbol, address(this)));
        usdPrice[stock] = usd;
        priceAt[stock] = block.timestamp;
        stocks.push(stock);
        emit Listed(stock, symbol, usd);
    }

    /// @notice Post new USD prices (18 decimals), from Atlas.
    function setUsdPrices(address[] calldata stocks_, uint256[] calldata usd) external {
        if (msg.sender != owner() && msg.sender != keeper) revert NotPriceSetter();
        if (stocks_.length != usd.length) revert LengthMismatch();
        for (uint256 i; i < stocks_.length; ++i) {
            if (usdPrice[stocks_[i]] == 0) revert NotListed(stocks_[i]);
            if (usd[i] == 0) revert ZeroPrice();
            usdPrice[stocks_[i]] = usd[i];
            priceAt[stocks_[i]] = block.timestamp;
            emit PriceSet(stocks_[i], usd[i]);
        }
    }

    /// @notice Register (or remove, with 0) an ERC20 quote and its USD price.
    function setQuote(address quote, uint256 usd) external onlyOwner {
        quoteUsd[quote] = usd;
        emit QuoteSet(quote, usd);
    }

    /// @notice Set (or clear, with address(0)) the price keeper.
    function setKeeper(address keeper_) external onlyOwner {
        keeper = keeper_;
        emit KeeperSet(keeper_);
    }

    /// @notice Let the market mint `quote` to pay sellers. Only for free-mint test tokens.
    function setMintableQuote(address quote, bool mintable) external onlyOwner {
        mintableQuote[quote] = mintable;
        emit MintableQuoteSet(quote, mintable);
    }

    function stockCount() external view returns (uint256) {
        return stocks.length;
    }

    function buy(address stock, address to) external payable returns (uint256 amount) {
        amount = _mintFor(stock, address(0), msg.value, to);
    }

    function buyWith(address stock, address quote, uint256 amount, address to) external returns (uint256 stockAmount) {
        if (quote == address(0) || quoteUsd[quote] == 0) revert NotQuote(quote);
        quote.safeTransferFrom(msg.sender, address(this), amount);
        stockAmount = _mintFor(stock, quote, amount, to);
    }

    function _mintFor(address stock, address quote, uint256 paid, address to) internal returns (uint256 amount) {
        uint256 price = priceIn(stock, quote);
        if (price == 0) revert NotListed(stock);
        amount = paid * 1e18 / price;
        if (amount == 0) revert ZeroAmount();
        MockBStock(stock).mint(to, amount);
        emit Bought(stock, quote, to, paid, amount);
    }

    /// @notice Sell `amount` of the caller's `stock` for BNB, paid to `to` from the BNB this market holds.
    function sell(address stock, uint256 amount, address to) external returns (uint256 paid) {
        paid = _sell(stock, address(0), amount, to);
    }

    /// @notice Sell `amount` of the caller's `stock` for `quote`: BNB (address(0)) from the market's balance, or a
    ///         mintable quote, minted to `to`.
    function sellFor(address stock, address quote, uint256 amount, address to) external returns (uint256 paid) {
        paid = _sell(stock, quote, amount, to);
    }

    function _sell(address stock, address quote, uint256 amount, address to) internal returns (uint256 paid) {
        if (quote != address(0) && !mintableQuote[quote]) revert NotQuote(quote);
        uint256 price = priceIn(stock, quote);
        if (price == 0) revert NotListed(stock);
        paid = amount * price / 1e18;
        if (paid == 0) revert ZeroAmount();
        MockBStock(stock).burn(msg.sender, amount);
        if (quote == address(0)) to.safeTransferETH(paid);
        else IMintable(quote).mint(to, paid);
        emit Sold(stock, quote, msg.sender, amount, paid);
    }

    /// @notice Top up the BNB that pays for sells.
    receive() external payable {}

    /// @notice Testnet only: take back BNB or an ERC20 the market holds.
    function withdraw(address token, uint256 amount, address to) external onlyOwner {
        if (token == address(0)) to.safeTransferETH(amount);
        else token.safeTransfer(to, amount);
    }
}
