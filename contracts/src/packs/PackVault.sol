// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Initializable} from "@openzeppelin-contracts-upgradeable/proxy/utils/Initializable.sol";
import {ERC721} from "solady/tokens/ERC721.sol";
import {LibString} from "solady/utils/LibString.sol";
import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";
import {DirectLaunchVaultBase} from "src/flap/DirectLaunchVaultBase.sol";
import {VaultUISchema, VaultMethodSchema, FieldDescriptor} from "src/flap/IVaultSchemas.sol";
import {IStockMarket} from "src/stocks/MockStockMarket.sol";
import {PackBasket, PackOdds, IPackLauncher} from "./PackTypes.sol";

/// @title PackVault
/// @notice The stock-pack vault of one coin. The coin's trading tax (native BNB) and part of its presale fill a pool;
///         holders open packs into card NFTs that each hold a bStock, and burn a card to take the bStock out.
///
///           presale seed ──┐
///           tax dispatch ──┼─► pool (BNB) ──open + reveal──► buys bStock ──► card NFT ──redeem──► holder
///           pack sales ────┘
///
///         - Packs: every presale pack bought from the Launcher, plus packs bought here after launch at the same
///           price (the whole price goes into the pool).
///         - Prizes: each pack pays one card worth 10% to 300% of the pack price depending on the style, 90% on
///           average (`PackOdds`). The stock is drawn by the basket's weights.
///         - Solvency: a pack opens only when the pool, after what pending reveals have set aside, covers the top
///           prize. Cards hold their bStock in this contract until redeemed.
///         - Randomness: `open` commits to the next block; `reveal` (anyone may call it) reads that block's hash. A
///           reveal later than 256 blocks pays the lowest prize, so waiting never helps.
///         - Nobody can withdraw the pool. No fee is taken.
///
/// @dev Deployed per launch as a beacon proxy by `PackVaultFactory`, which validates everything it is given.
contract PackVault is DirectLaunchVaultBase, ERC721, Initializable {
    using SafeTransferLib for address;

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

    address public taxToken;
    address public launcher;
    address public creator;
    address public market;
    uint256 public packPrice;
    uint8 public style;
    address[] internal _stocks;
    uint16[] internal _weights;
    string internal _coinName;

    /// @notice Packs bought here after launch.
    mapping(address account => uint256 count) public boughtPacks;
    /// @notice Packs each account has opened (presale and bought together).
    mapping(address account => uint256 count) public openedPacks;

    /// @notice BNB set aside for reveals in flight: the top prize of each.
    uint256 public pendingReserve;
    uint256 public revealCount;
    mapping(uint256 id => Reveal) public reveals;

    uint256 public cardCount;
    mapping(uint256 id => Card) public cards;

    error ZeroAddress();
    error BadQuantity();
    error WrongPayment(uint256 sent, uint256 expected);
    error NoPacks();
    error PoolTooSmall(uint256 free, uint256 needed);
    error UnknownReveal(uint256 id);
    error AlreadyRevealed(uint256 id);
    error RevealNotReady(uint256 id);
    error NotYourCard(uint256 id);

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

    /// @dev Called once by the factory in `newVault`, after it validated `basket` and `packPrice`.
    function initialize(address taxToken_, address launcher_, PackBasket calldata basket_, uint256 packPrice_)
        external
        initializer
    {
        if (taxToken_ == address(0) || launcher_ == address(0) || basket_.market == address(0)) revert ZeroAddress();
        taxToken = taxToken_;
        launcher = launcher_;
        creator = IPackLauncher(launcher_).creator();
        _coinName = IPackLauncher(launcher_).name();
        market = basket_.market;
        packPrice = packPrice_;
        style = basket_.style;
        _stocks = basket_.stocks;
        _weights = basket_.weights;
    }

    /// @notice Tax dispatch and the presale seed arrive here. Kept cheap: the Portal may forward limited gas.
    receive() external payable {
        emit Funded(msg.sender, msg.value);
    }

    function version() external pure returns (string memory) {
        return "v1.0.0";
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Packs
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Unopened packs: presale packs from the Launcher plus packs bought here, minus those opened.
    function packsOf(address account) public view returns (uint256) {
        return IPackLauncher(launcher).packsOf(account) + boughtPacks[account] - openedPacks[account];
    }

    /// @notice Buy packs at the pack price. The whole payment goes into the pool.
    function buy(uint256 quantity) external payable {
        if (quantity == 0 || quantity > MAX_BUY) revert BadQuantity();
        uint256 cost = quantity * packPrice;
        if (msg.value != cost) revert WrongPayment(msg.value, cost);
        boughtPacks[msg.sender] += quantity;
        emit PacksBought(msg.sender, quantity, cost);
    }

    /// @notice BNB in the pool not set aside for reveals in flight.
    function freeBalance() public view returns (uint256) {
        uint256 bal = address(this).balance;
        return bal > pendingReserve ? bal - pendingReserve : 0;
    }

    /// @notice The top prize of one pack, which the pool must cover before it opens.
    function maxPayout() public view returns (uint256) {
        return packPrice * PackOdds.maxBps(style) / 10_000;
    }

    /// @notice Whether a pack could open right now.
    function canOpen() external view returns (bool) {
        return freeBalance() >= maxPayout();
    }

    /// @notice Open one of your packs. The card is drawn from the next block's hash by `reveal`.
    function open() external returns (uint256 id) {
        if (packsOf(msg.sender) == 0) revert NoPacks();
        uint256 needed = maxPayout();
        uint256 free = freeBalance();
        if (free < needed) revert PoolTooSmall(free, needed);

        openedPacks[msg.sender] += 1;
        pendingReserve += needed;
        id = ++revealCount;
        reveals[id] = Reveal({owner: msg.sender, revealBlock: uint64(block.number + 1), done: false});
        emit PackOpened(id, msg.sender, block.number + 1);
    }

    /// @notice Reveal an opened pack: buy its bStock and mint the card to the pack's owner. Anyone may call.
    function reveal(uint256 id) external returns (uint256 cardId) {
        Reveal storage r = reveals[id];
        if (r.owner == address(0)) revert UnknownReveal(id);
        if (r.done) revert AlreadyRevealed(id);
        if (block.number <= r.revealBlock) revert RevealNotReady(id);
        r.done = true;

        uint8 s = style;
        pendingReserve -= packPrice * PackOdds.maxBps(s) / 10_000;

        bytes32 hash = blockhash(r.revealBlock);
        bool late = hash == bytes32(0);
        uint256 seed = uint256(keccak256(abi.encode(late ? bytes32(id) : hash, id, address(this))));
        uint16 bps = late ? PackOdds.minBps(s) : PackOdds.roll(s, seed >> 128);
        address stock = _pickStock(seed & type(uint128).max);

        uint256 value = packPrice * bps / 10_000;
        uint256 amount = IStockMarket(market).buy{value: value}(stock, address(this));

        cardId = ++cardCount;
        cards[cardId] = Card({stock: stock, rollBps: bps, valueWei: value, amount: amount});
        _mint(r.owner, cardId);
        emit CardRevealed(id, cardId, r.owner, stock, bps, value, amount, late);
    }

    /// @notice Burn your card and receive the bStock it holds.
    function redeem(uint256 cardId) external {
        if (ownerOf(cardId) != msg.sender) revert NotYourCard(cardId);
        Card memory c = cards[cardId];
        _burn(cardId);
        c.stock.safeTransfer(msg.sender, c.amount);
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

    // ─────────────────────────────────────────────────────────────────────────
    // Card NFT
    // ─────────────────────────────────────────────────────────────────────────

    function name() public view override returns (string memory) {
        return string.concat(_coinName, " Cards");
    }

    function symbol() public pure override returns (string memory) {
        return "CARD";
    }

    function tokenURI(uint256 id) public view override returns (string memory) {
        if (!_exists(id)) revert TokenDoesNotExist();
        Card memory c = cards[id];
        return string.concat(
            'data:application/json;utf8,{"name":"',
            LibString.escapeJSON(_coinName),
            " card #",
            LibString.toString(id),
            '","attributes":[{"trait_type":"stock","value":"',
            LibString.toHexString(c.stock),
            '"},{"trait_type":"amount","value":"',
            LibString.toString(c.amount),
            '"},{"trait_type":"roll_bps","value":"',
            LibString.toString(c.rollBps),
            '"}]}'
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // IDirectLaunchVault
    // ─────────────────────────────────────────────────────────────────────────

    /// @inheritdoc DirectLaunchVaultBase
    function description() public view override returns (string memory) {
        uint16[10] memory t = PackOdds.table(style);
        return string.concat(
            "PackVault: this coin's tax share and part of its presale fill a BNB pool. A pack costs ",
            LibString.toString(packPrice),
            " wei, all of it into the pool, and opens to one card holding a bStock worth ",
            LibString.toString(t[0] / 100),
            "% to ",
            LibString.toString(t[9] / 100),
            "% of the pack price (90% on average), bought from market ",
            LibString.toHexString(market),
            ". A pack opens only when the pool covers the top prize. Burn a card to take its bStock. No fee; nobody can withdraw the pool. Free pool now: ",
            LibString.toString(freeBalance()),
            " wei."
        );
    }

    /// @inheritdoc DirectLaunchVaultBase
    function vaultUISchema() public pure override returns (VaultUISchema memory schema) {
        schema.vaultType = "PackVault";
        schema.description =
            "Stock packs: open a pack into a card that holds a bStock, burn the card to take the bStock.";
        schema.methods = new VaultMethodSchema[](6);

        schema.methods[0].name = "packsOf";
        schema.methods[0].description = "Unopened packs of an account.";
        schema.methods[0].inputs = new FieldDescriptor[](1);
        schema.methods[0].inputs[0] = FieldDescriptor("account", "address", "Holder", 0);
        schema.methods[0].outputs = new FieldDescriptor[](1);
        schema.methods[0].outputs[0] = FieldDescriptor("count", "uint256", "Packs", 0);

        schema.methods[1].name = "freeBalance";
        schema.methods[1].description = "BNB in the pool that packs can draw on.";
        schema.methods[1].outputs = new FieldDescriptor[](1);
        schema.methods[1].outputs[0] = FieldDescriptor("amount", "uint256", "Free pool", 18);

        schema.methods[2].name = "buy";
        schema.methods[2].description = "Buy packs at the pack price.";
        schema.methods[2].inputs = new FieldDescriptor[](2);
        schema.methods[2].inputs[0] = FieldDescriptor("quantity", "uint256", "Packs (1-20)", 0);
        schema.methods[2].inputs[1] = FieldDescriptor("value", "msg.value", "quantity x pack price", 18);
        schema.methods[2].isWriteMethod = true;

        schema.methods[3].name = "open";
        schema.methods[3].description = "Open one pack; reveal it from the next block.";
        schema.methods[3].isWriteMethod = true;

        schema.methods[4].name = "reveal";
        schema.methods[4].description = "Reveal an opened pack into its card. Anyone may call.";
        schema.methods[4].inputs = new FieldDescriptor[](1);
        schema.methods[4].inputs[0] = FieldDescriptor("id", "uint256", "Reveal id from open", 0);
        schema.methods[4].isWriteMethod = true;

        schema.methods[5].name = "redeem";
        schema.methods[5].description = "Burn a card and receive its bStock.";
        schema.methods[5].inputs = new FieldDescriptor[](1);
        schema.methods[5].inputs[0] = FieldDescriptor("cardId", "uint256", "Card", 0);
        schema.methods[5].isWriteMethod = true;
    }
}
