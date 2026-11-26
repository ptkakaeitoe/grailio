// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {IOpenFourToken} from "../openfour/interfaces/IOpenFourToken.sol";
import {IStockMarket, PackOdds} from "./PackOdds.sol";

interface IWBNB {
    function withdraw(uint256 amount) external;
}

interface IPurchases {
    function totalPurchased(address trader) external view returns (uint256);
}

/// @title OpenFourPackVault
/// @notice The stock-pack vault of one OpenFour coin (Grailio). Not an OpenFour Vault slot: the coin keeps
///         OpenFour's StandardVault for custody, and this contract only receives the stock-pool share of the raise at
///         migration, plus packs bought after launch.
///
///           inner market buys ──► presale packs (tokens bought ÷ tokens per pack, read from CustomData)
///           migration ──stockPoolBps of the raise──► pool (BNB) ──open + reveal──► buys bStock ──► card NFT
///           pack sales ──────────────────────────────►                                      redeem ──► holder
///
///         Same rules as the Flap PackVault: a pack opens only when the pool covers its top prize; `open` commits to
///         the next block and anyone may `reveal`; a reveal later than 256 blocks pays the lowest prize; nobody can
///         withdraw the pool; no fee.
/// @dev One clone per coin, created and initialized by `PackMigrateModule.init`.
contract OpenFourPackVault is Initializable, ERC721Upgradeable {
    using SafeERC20 for IERC20;
    using Strings for uint256;

    uint256 public constant MAX_BUY = 20;

    struct Reveal {
        address owner;
        uint64 revealBlock;
        bool done;
    }

    struct Card {
        address stock;
        uint16 rollBps;
        uint256 valueWei;
        uint256 amount;
    }

    address public token;
    address public migrateModule;
    address public wbnb;
    address public market;
    uint256 public packPrice;
    uint256 public tokensPerPack;
    uint8 public style;
    address[] internal _stocks;
    uint16[] internal _weights;

    mapping(address => uint256) public boughtPacks;
    mapping(address => uint256) public openedPacks;
    uint256 public pendingReserve;
    uint256 public revealCount;
    mapping(uint256 => Reveal) public reveals;
    uint256 public cardCount;
    mapping(uint256 => Card) public cards;

    event Funded(address indexed from, uint256 amount);
    event PacksBought(address indexed buyer, uint256 quantity, uint256 paid);
    event PackOpened(uint256 indexed revealId, address indexed owner, uint256 revealBlock);
    event CardRevealed(
        uint256 indexed revealId,
        uint256 indexed cardId,
        address indexed owner,
        address stock,
        uint16 rollBps,
        uint256 valueWei,
        uint256 amount,
        bool late
    );
    event CardRedeemed(uint256 indexed cardId, address indexed owner, address stock, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address token_,
        address wbnb_,
        address market_,
        uint256 packPrice_,
        uint256 tokensPerPack_,
        uint8 style_,
        address[] calldata stocks_,
        uint16[] calldata weights_
    ) external initializer {
        require(token_ != address(0) && wbnb_ != address(0) && market_ != address(0), "PackVault: zero address");
        require(packPrice_ > 0 && tokensPerPack_ > 0 && style_ < PackOdds.STYLES, "PackVault: bad config");
        require(stocks_.length > 0 && stocks_.length == weights_.length, "PackVault: bad basket");
        __ERC721_init("", "CARD");
        token = token_;
        migrateModule = msg.sender;
        wbnb = wbnb_;
        market = market_;
        packPrice = packPrice_;
        tokensPerPack = tokensPerPack_;
        style = style_;
        _stocks = stocks_;
        _weights = weights_;
    }

    /// @notice BNB arrives here: pack sales, WBNB unwraps, direct top-ups.
    receive() external payable {
        if (msg.sender != wbnb) emit Funded(msg.sender, msg.value);
    }

    /// @notice Unwrap any WBNB held (the migration share arrives as WBNB). Anyone may call.
    function unwrap() public {
        uint256 bal = IERC20(wbnb).balanceOf(address(this));
        if (bal == 0) return;
        IWBNB(wbnb).withdraw(bal);
        emit Funded(migrateModule, bal);
    }

    // ── Packs ────────────────────────────────────────────────────────────

    /// @notice Packs earned in the inner market: tokens bought there ÷ tokens per pack.
    function presalePacksOf(address account) public view returns (uint256) {
        address data = IOpenFourToken(token).customData();
        if (data == address(0)) return 0;
        return IPurchases(data).totalPurchased(account) / tokensPerPack;
    }

    /// @notice Unopened packs: presale packs plus packs bought here, minus those opened.
    function packsOf(address account) public view returns (uint256) {
        return presalePacksOf(account) + boughtPacks[account] - openedPacks[account];
    }

    function buy(uint256 quantity) external payable {
        require(quantity > 0 && quantity <= MAX_BUY, "PackVault: bad quantity");
        uint256 cost = quantity * packPrice;
        require(msg.value == cost, "PackVault: wrong payment");
        boughtPacks[msg.sender] += quantity;
        emit PacksBought(msg.sender, quantity, cost);
    }

    function freeBalance() public view returns (uint256) {
        uint256 bal = address(this).balance + IERC20(wbnb).balanceOf(address(this));
        return bal > pendingReserve ? bal - pendingReserve : 0;
    }

    function maxPayout() public view returns (uint256) {
        return packPrice * PackOdds.maxBps(style) / 10_000;
    }

    function canOpen() external view returns (bool) {
        return freeBalance() >= maxPayout();
    }

    function open() external returns (uint256 id) {
        require(packsOf(msg.sender) > 0, "PackVault: no packs");
        uint256 needed = maxPayout();
        require(freeBalance() >= needed, "PackVault: pool too small");
        openedPacks[msg.sender] += 1;
        pendingReserve += needed;
        id = ++revealCount;
        reveals[id] = Reveal({owner: msg.sender, revealBlock: uint64(block.number + 1), done: false});
        emit PackOpened(id, msg.sender, block.number + 1);
    }

    function reveal(uint256 id) external returns (uint256 cardId) {
        Reveal storage r = reveals[id];
        require(r.owner != address(0), "PackVault: unknown reveal");
        require(!r.done, "PackVault: revealed");
        require(block.number > r.revealBlock, "PackVault: not ready");
        r.done = true;

        uint8 s = style;
        pendingReserve -= packPrice * PackOdds.maxBps(s) / 10_000;

        bytes32 hash = blockhash(r.revealBlock);
        bool late = hash == bytes32(0);
        uint256 seed = uint256(keccak256(abi.encode(late ? bytes32(id) : hash, id, address(this))));
        uint16 bps = late ? PackOdds.minBps(s) : PackOdds.roll(s, seed >> 128);
        address stock = _pickStock(seed & type(uint128).max);

        uint256 value = packPrice * bps / 10_000;
        if (address(this).balance < value) unwrap();
        uint256 amount = IStockMarket(market).buy{value: value}(stock, address(this));

        cardId = ++cardCount;
        cards[cardId] = Card({stock: stock, rollBps: bps, valueWei: value, amount: amount});
        _mint(r.owner, cardId);
        emit CardRevealed(id, cardId, r.owner, stock, bps, value, amount, late);
    }

    function redeem(uint256 cardId) external {
        require(ownerOf(cardId) == msg.sender, "PackVault: not your card");
        Card memory c = cards[cardId];
        _burn(cardId);
        IERC20(c.stock).safeTransfer(msg.sender, c.amount);
        emit CardRedeemed(cardId, msg.sender, c.stock, c.amount);
    }

    function _pickStock(uint256 r) internal view returns (address) {
        uint256 roll = r % 10_000;
        uint256 cumulative;
        uint256 n = _stocks.length;
        for (uint256 i; i < n; ++i) {
            cumulative += _weights[i];
            if (roll < cumulative) return _stocks[i];
        }
        return _stocks[n - 1];
    }

    function basket() external view returns (address[] memory stocks, uint16[] memory weights) {
        return (_stocks, _weights);
    }

    // ── Card NFT ─────────────────────────────────────────────────────────

    function name() public view override returns (string memory) {
        return string.concat(IERC20Metadata(token).name(), " Cards");
    }

    function tokenURI(uint256 id) public view override returns (string memory) {
        _requireMinted(id);
        Card memory c = cards[id];
        return string.concat(
            'data:application/json;utf8,{"name":"Card #',
            id.toString(),
            '","attributes":[{"trait_type":"stock","value":"',
            Strings.toHexString(c.stock),
            '"},{"trait_type":"amount","value":"',
            c.amount.toString(),
            '"},{"trait_type":"roll_bps","value":"',
            uint256(c.rollBps).toString(),
            '"}]}'
        );
    }
}
