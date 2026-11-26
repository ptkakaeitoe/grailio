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
/// @notice The stock-pack vault of one coin. Its quote currency is the coin's (native BNB or an ERC20 such as USD).
///
///   Money in                                   Where it goes
///   ─────────────────────────────────────────  ─────────────────────────────────────────────────────────────
///   trading tax (the coin's VAULT slot)        50% pool · 30% card stakers · 15% creator · 5% platform
///   presale seed (from the Launcher)           presale reserve, which only pays presale packs
///   pack purchases                             set aside for that pack's top prize; the margin joins the pool
///
///   - Tiers (`PackOdds`): Low always pays 95% and can always be bought; Medium and High (90% on average) can be
///     bought only while the pool covers their top prize. A bought pack's top prize is set aside when it is bought,
///     so every bought pack can always be opened.
///   - Presale packs: each pays its fair share of what is left in the presale reserve (reserve left ÷ presale packs
///     left), times a Medium-spread roll scaled to average 1x; the last presale pack gets whatever remains. They open
///     right after launch and together pay out exactly the reserve.
///   - Opening commits to the next block; `reveal` (anyone may call it) draws the card, buys its bStock at the
///     market's Atlas price and mints the card NFT. A reveal later than 256 blocks pays the lowest outcome.
///   - Cards can be staked here to earn the stakers' share of the tax, weighted by the value they were opened at;
///     each new reward streams out over 7 days. Burning a card (not staked) pays out its bStock.
///   - Nobody can withdraw the pool, the presale reserve or stakers' rewards.
///
/// @dev Accounting is by balance delta: anything in the quote balance not already in a bucket is new tax revenue,
///      recognized lazily (`sync`). ERC20 tax arrives as a plain transfer plus an empty ping to `receive()`.
contract PackVault is DirectLaunchVaultBase, ERC721, Initializable {
    using SafeTransferLib for address;

    uint8 public constant PRESALE = 3;
    uint16 public constant POOL_BPS = 5000;
    uint16 public constant STAKER_BPS = 3000;
    uint16 public constant CREATOR_BPS = 1500;
    uint16 public constant PLATFORM_BPS = 500;
    uint256 public constant MAX_BUY = 20;
    uint256 public constant STREAM = 7 days;
    uint256 internal constant ACC = 1e18;

    struct Reveal {
        address owner;
        uint64 revealBlock;
        uint8 kind;
        bool done;
    }

    struct Card {
        address stock;
        uint8 kind;
        uint16 rollBps;
        uint256 value;
        uint256 amount;
    }

    address public taxToken;
    address public launcher;
    address public creator;
    address public platform;
    address public market;
    /// @notice address(0) = native BNB, else the ERC20 quote.
    address public quote;
    uint256 public packPrice;
    address[] internal _stocks;
    uint16[] internal _weights;
    string internal _coinName;

    // Buckets (quote units). Everything else in the balance is unrecognized tax.
    /// @notice Pays Medium and High prizes beyond what their buyers paid; grows with margins and the pool's tax share.
    uint256 public pool;
    /// @notice Top prizes set aside for bought, unopened packs and reveals in flight.
    uint256 public reserved;
    /// @notice Pays presale packs only.
    uint256 public presaleReserve;
    /// @notice Presale packs not yet revealed.
    uint256 public presaleLeft;
    uint256 public creatorOwed;
    uint256 public platformOwed;
    /// @notice Everything held for stakers: queued, streaming and earned-but-unclaimed.
    uint256 public stakePot;

    mapping(address account => uint256[3] counts) internal _bought;
    mapping(address account => uint256 count) public presaleOpened;
    uint256 public revealCount;
    mapping(uint256 id => Reveal) public reveals;
    uint256 public cardCount;
    mapping(uint256 id => Card) public cards;

    // Staking: reward per weight, streamed.
    uint256 public totalWeight;
    /// @notice Quote per second, scaled by 1e18.
    uint256 public rewardRate;
    uint256 public periodFinish;
    uint256 public lastUpdate;
    uint256 public accPerWeight;
    /// @notice Rewards that arrived while nothing was staked; they start streaming at the next stake.
    uint256 public queued;
    mapping(address account => uint256 weight) public weightOf;
    mapping(address account => uint256 acc) internal _paidPerWeight;
    mapping(address account => uint256 amount) internal _earned;
    mapping(uint256 cardId => address owner) public stakedBy;

    error ZeroAddress();
    error BadQuantity();
    error BadTier(uint8 tier);
    error WrongPayment(uint256 sent, uint256 expected);
    error TierLocked(uint8 tier, uint256 pool, uint256 needed);
    error NoPacks();
    error UnknownReveal(uint256 id);
    error AlreadyRevealed(uint256 id);
    error RevealNotReady(uint256 id);
    error NotYourCard(uint256 id);
    error NotStaked(uint256 id);
    error NothingToClaim();
    error OnlyLauncher();
    error AlreadyFunded();
    error Unauthorized();

    event Funded(address indexed from, uint256 amount);
    event RevenueSplit(uint256 amount, uint256 toPool, uint256 toStakers, uint256 toCreator, uint256 toPlatform);
    event PresaleFunded(uint256 amount, uint256 packs);
    event PacksBought(address indexed buyer, uint8 indexed tier, uint256 quantity, uint256 paid);
    event PackOpened(uint256 indexed revealId, address indexed owner, uint8 kind, uint256 revealBlock);
    event CardRevealed(
        uint256 indexed revealId,
        uint256 indexed cardId,
        address indexed owner,
        uint8 kind,
        address stock,
        uint16 rollBps,
        uint256 value,
        uint256 amount,
        bool late
    );
    event CardRedeemed(uint256 indexed cardId, address indexed owner, address stock, uint256 amount);
    event Staked(address indexed account, uint256 indexed cardId, uint256 weight);
    event Unstaked(address indexed account, uint256 indexed cardId, uint256 weight);
    event RewardPaid(address indexed account, uint256 amount);
    event Claimed(address indexed to, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @dev Called once by the factory in `newVault`, after it validated everything it passes.
    function initialize(
        address taxToken_,
        address launcher_,
        PackBasket calldata basket_,
        uint256 packPrice_,
        address quote_,
        address platform_
    ) external initializer {
        if (taxToken_ == address(0) || launcher_ == address(0) || basket_.market == address(0) || platform_ == address(0)) {
            revert ZeroAddress();
        }
        taxToken = taxToken_;
        launcher = launcher_;
        creator = IPackLauncher(launcher_).creator();
        _coinName = IPackLauncher(launcher_).name();
        market = basket_.market;
        quote = quote_;
        platform = platform_;
        packPrice = packPrice_;
        _stocks = basket_.stocks;
        _weights = basket_.weights;
    }

    /// @notice Native tax, and ERC20 tax pings, land here. Kept cheap: revenue is recognized later by `sync`.
    receive() external payable {
        if (msg.value > 0) emit Funded(msg.sender, msg.value);
    }

    function version() external pure returns (string memory) {
        return "v2.0.0";
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Revenue
    // ─────────────────────────────────────────────────────────────────────────

    function _balance() internal view returns (uint256) {
        return quote == address(0) ? address(this).balance : SafeTransferLib.balanceOf(quote, address(this));
    }

    function _accounted() internal view returns (uint256) {
        return pool + reserved + presaleReserve + creatorOwed + platformOwed + stakePot;
    }

    /// @notice Tax that has arrived but isn't split yet.
    function unrecognized() public view returns (uint256) {
        uint256 bal = _balance();
        uint256 acc = _accounted();
        return bal > acc ? bal - acc : 0;
    }

    /// @notice Split any new tax revenue. Anyone may call; every state-changing function calls it first.
    function sync() public {
        _sync(0);
    }

    /// @dev `incoming` is native value already in the balance that is not revenue (a payable call's msg.value).
    function _sync(uint256 incoming) internal {
        uint256 bal = _balance() - incoming;
        uint256 acc = _accounted();
        if (bal <= acc) return;
        uint256 amount = bal - acc;
        uint256 toStakers = amount * STAKER_BPS / 10_000;
        uint256 toCreator = amount * CREATOR_BPS / 10_000;
        uint256 toPlatform = amount * PLATFORM_BPS / 10_000;
        uint256 toPool = amount - toStakers - toCreator - toPlatform;
        pool += toPool;
        creatorOwed += toCreator;
        platformOwed += toPlatform;
        stakePot += toStakers;
        _accrue();
        _restream(toStakers);
        emit RevenueSplit(amount, toPool, toStakers, toCreator, toPlatform);
    }

    /// @notice Pay the creator its share. The creator or the Flap Guardian may trigger it; it always pays the creator.
    function claimCreator() external {
        if (msg.sender != creator && msg.sender != _getGuardian()) revert Unauthorized();
        _sync(0);
        uint256 amount = creatorOwed;
        if (amount == 0) revert NothingToClaim();
        creatorOwed = 0;
        _send(creator, amount);
        emit Claimed(creator, amount);
    }

    /// @notice Pay the platform its share. The platform or the Flap Guardian may trigger it; it always pays the platform.
    function claimPlatform() external {
        if (msg.sender != platform && msg.sender != _getGuardian()) revert Unauthorized();
        _sync(0);
        uint256 amount = platformOwed;
        if (amount == 0) revert NothingToClaim();
        platformOwed = 0;
        _send(platform, amount);
        emit Claimed(platform, amount);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Presale reserve
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice The Launcher funds the presale reserve once, at launch. Native: send the amount as value. ERC20: approve
    ///         this vault first; it pulls the amount.
    function fundPresale(uint256 amount) external payable {
        if (msg.sender != launcher) revert OnlyLauncher();
        if (presaleLeft != 0 || presaleReserve != 0) revert AlreadyFunded();
        if (quote == address(0)) {
            if (msg.value != amount) revert WrongPayment(msg.value, amount);
            _sync(msg.value);
        } else {
            if (msg.value != 0) revert WrongPayment(msg.value, 0);
            _sync(0);
            quote.safeTransferFrom(msg.sender, address(this), amount);
        }
        presaleReserve = amount;
        presaleLeft = IPackLauncher(launcher).packsForSale();
        emit PresaleFunded(amount, presaleLeft);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Packs
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Top prize of one pack of `tier`.
    function maxPayout(uint8 tier) public view returns (uint256) {
        return packPrice * PackOdds.maxBps(tier) / 10_000;
    }

    /// @notice How much of the pool buying `quantity` packs of `tier` needs (top prizes beyond what they cost).
    function poolNeeded(uint8 tier, uint256 quantity) public view returns (uint256) {
        uint256 top = maxPayout(tier) * quantity;
        uint256 cost = packPrice * quantity;
        return top > cost ? top - cost : 0;
    }

    /// @notice Whether `quantity` packs of `tier` can be bought now (Low: always).
    function canBuy(uint8 tier, uint256 quantity) external view returns (bool) {
        if (tier >= PackOdds.TIERS) return false;
        uint256 incoming = unrecognized() * POOL_BPS / 10_000;
        return pool + incoming >= poolNeeded(tier, quantity);
    }

    /// @notice Unopened packs of an account: presale, Low, Medium, High.
    function packsOf(address account) external view returns (uint256 presale, uint256 low, uint256 medium, uint256 high) {
        uint256[3] storage b = _bought[account];
        return (presalePacksOf(account), b[0], b[1], b[2]);
    }

    function presalePacksOf(address account) public view returns (uint256) {
        if (presaleLeft == 0) return 0; // not funded yet, or all presale packs revealed
        return IPackLauncher(launcher).packsOf(account) - presaleOpened[account];
    }

    /// @notice Buy packs of a tier at the pack price. Native: send quantity × price. ERC20: approve this vault first.
    function buy(uint8 tier, uint256 quantity) external payable {
        if (tier >= PackOdds.TIERS) revert BadTier(tier);
        if (quantity == 0 || quantity > MAX_BUY) revert BadQuantity();
        uint256 cost = packPrice * quantity;
        if (quote == address(0)) {
            if (msg.value != cost) revert WrongPayment(msg.value, cost);
            _sync(msg.value);
        } else {
            if (msg.value != 0) revert WrongPayment(msg.value, 0);
            _sync(0);
            quote.safeTransferFrom(msg.sender, address(this), cost);
        }
        uint256 top = maxPayout(tier) * quantity;
        if (top > cost) {
            uint256 need = top - cost;
            if (pool < need) revert TierLocked(tier, pool, need);
            pool -= need;
        } else {
            pool += cost - top;
        }
        reserved += top;
        _bought[msg.sender][tier] += quantity;
        emit PacksBought(msg.sender, tier, quantity, cost);
    }

    /// @notice Open one pack. `kind` 0-2 is a bought tier, 3 a presale pack. The card is drawn by `reveal`.
    function open(uint8 kind) external returns (uint256 id) {
        _sync(0);
        if (kind == PRESALE) {
            if (presalePacksOf(msg.sender) == 0) revert NoPacks();
            presaleOpened[msg.sender] += 1;
        } else {
            if (kind >= PackOdds.TIERS) revert BadTier(kind);
            if (_bought[msg.sender][kind] == 0) revert NoPacks();
            _bought[msg.sender][kind] -= 1;
        }
        id = ++revealCount;
        reveals[id] = Reveal({owner: msg.sender, revealBlock: uint64(block.number + 1), kind: kind, done: false});
        emit PackOpened(id, msg.sender, kind, block.number + 1);
    }

    /// @notice Reveal an opened pack: buy its bStock and mint the card to the pack's owner. Anyone may call.
    function reveal(uint256 id) external returns (uint256 cardId) {
        Reveal storage r = reveals[id];
        if (r.owner == address(0)) revert UnknownReveal(id);
        if (r.done) revert AlreadyRevealed(id);
        if (block.number <= r.revealBlock) revert RevealNotReady(id);
        r.done = true;
        _sync(0);

        bytes32 hash = blockhash(r.revealBlock);
        bool late = hash == bytes32(0);
        uint256 seed = uint256(keccak256(abi.encode(late ? bytes32(id) : hash, id, address(this))));
        uint8 kind = r.kind;
        uint8 tier = kind == PRESALE ? PackOdds.MEDIUM : kind;
        uint16 bps = late ? PackOdds.minBps(tier) : PackOdds.roll(tier, seed >> 128);
        uint256 value = _payout(kind, bps);
        address stock = _pickStock(seed & type(uint128).max);

        cardId = ++cardCount;
        cards[cardId] = Card({stock: stock, kind: kind, rollBps: bps, value: value, amount: _buyStock(stock, value)});
        _mint(r.owner, cardId);
        _emitRevealed(id, cardId, r.owner, late);
    }

    function _emitRevealed(uint256 id, uint256 cardId, address owner, bool late) internal {
        Card storage c = cards[cardId];
        emit CardRevealed(id, cardId, owner, c.kind, c.stock, c.rollBps, c.value, c.amount, late);
    }

    /// @dev The card's value for a roll, moving it out of its bucket.
    function _payout(uint8 kind, uint16 bps) internal returns (uint256 value) {
        if (kind == PRESALE) {
            uint256 left = presaleLeft;
            if (left <= 1) {
                value = presaleReserve;
            } else {
                value = presaleReserve / left * bps / PackOdds.MEDIUM_AVG_BPS;
                if (value > presaleReserve) value = presaleReserve;
            }
            presaleReserve -= value;
            presaleLeft = left > 0 ? left - 1 : 0;
        } else {
            uint256 top = maxPayout(kind);
            value = packPrice * bps / 10_000;
            reserved -= top;
            pool += top - value;
        }
    }

    /// @dev Spend `value` of the quote on `stock`, held by this vault for the card.
    function _buyStock(address stock, uint256 value) internal returns (uint256 amount) {
        if (value == 0) return 0;
        if (quote == address(0)) return IStockMarket(market).buy{value: value}(stock, address(this));
        quote.safeApprove(market, value);
        return IStockMarket(market).buyWith(stock, quote, value, address(this));
    }

    /// @notice Burn your card (not staked) and receive the bStock it holds.
    function redeem(uint256 cardId) external {
        if (ownerOf(cardId) != msg.sender) revert NotYourCard(cardId);
        Card memory c = cards[cardId];
        _burn(cardId);
        if (c.amount > 0) c.stock.safeTransfer(msg.sender, c.amount);
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
    // Staking
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Stake cards to earn the stakers' share of the tax, weighted by each card's opened value.
    function stake(uint256[] calldata cardIds) external {
        _sync(0);
        _accrue();
        _settle(msg.sender);
        uint256 added;
        for (uint256 i; i < cardIds.length; ++i) {
            uint256 id = cardIds[i];
            if (ownerOf(id) != msg.sender) revert NotYourCard(id);
            uint256 w = cards[id].value;
            if (w == 0) revert NotYourCard(id);
            _transfer(msg.sender, address(this), id);
            stakedBy[id] = msg.sender;
            added += w;
            emit Staked(msg.sender, id, w);
        }
        weightOf[msg.sender] += added;
        totalWeight += added;
        if (queued > 0) _restream(0);
    }

    /// @notice Unstake cards (back to your wallet) and collect your rewards.
    function unstake(uint256[] calldata cardIds) external {
        _sync(0);
        _accrue();
        _settle(msg.sender);
        uint256 removed;
        for (uint256 i; i < cardIds.length; ++i) {
            uint256 id = cardIds[i];
            if (stakedBy[id] != msg.sender) revert NotStaked(id);
            delete stakedBy[id];
            _transfer(address(this), msg.sender, id);
            removed += cards[id].value;
            emit Unstaked(msg.sender, id, cards[id].value);
        }
        weightOf[msg.sender] -= removed;
        totalWeight -= removed;
        _payReward(msg.sender);
    }

    /// @notice Collect your staking rewards.
    function claimRewards() external {
        _sync(0);
        _accrue();
        _settle(msg.sender);
        if (_earned[msg.sender] == 0) revert NothingToClaim();
        _payReward(msg.sender);
    }

    /// @notice Rewards `account` could collect now (not counting tax that hasn't been split yet).
    function earned(address account) external view returns (uint256) {
        uint256 acc = accPerWeight;
        uint256 t = _lastApplicable();
        if (totalWeight > 0 && t > lastUpdate) acc += (t - lastUpdate) * rewardRate / totalWeight;
        return _earned[account] + weightOf[account] * (acc - _paidPerWeight[account]) / ACC;
    }

    function _lastApplicable() internal view returns (uint256) {
        return block.timestamp < periodFinish ? block.timestamp : periodFinish;
    }

    function _accrue() internal {
        uint256 t = _lastApplicable();
        if (t > lastUpdate) {
            if (totalWeight == 0) queued += (t - lastUpdate) * rewardRate / ACC;
            else accPerWeight += (t - lastUpdate) * rewardRate / totalWeight;
            lastUpdate = t;
        }
    }

    function _settle(address account) internal {
        _earned[account] += weightOf[account] * (accPerWeight - _paidPerWeight[account]) / ACC;
        _paidPerWeight[account] = accPerWeight;
    }

    /// @dev Restart the 7-day stream with `add`, whatever is still streaming, and anything queued (once staked).
    function _restream(uint256 add) internal {
        if (totalWeight == 0) {
            queued += add;
            return;
        }
        uint256 amount = add + queued;
        queued = 0;
        if (block.timestamp < periodFinish) amount += (periodFinish - block.timestamp) * rewardRate / ACC;
        if (amount == 0) return;
        rewardRate = amount * ACC / STREAM;
        lastUpdate = block.timestamp;
        periodFinish = block.timestamp + STREAM;
    }

    function _payReward(address account) internal {
        uint256 amount = _earned[account];
        if (amount == 0) return;
        if (amount > stakePot) amount = stakePot;
        _earned[account] -= amount;
        stakePot -= amount;
        _send(account, amount);
        emit RewardPaid(account, amount);
    }

    function _send(address to, uint256 amount) internal {
        if (quote == address(0)) to.safeTransferETH(amount);
        else quote.safeTransfer(to, amount);
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
            '"},{"trait_type":"value","value":"',
            LibString.toString(c.value),
            '"}]}'
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // IDirectLaunchVault
    // ─────────────────────────────────────────────────────────────────────────

    /// @inheritdoc DirectLaunchVaultBase
    function description() public view override returns (string memory) {
        return string.concat(
            "PackVault: this coin's tax is split 50% to the stock pool, 30% to card stakers (by card value, streamed over 7 days), 15% to the creator ",
            LibString.toHexString(creator),
            " and 5% to the platform ",
            LibString.toHexString(platform),
            ". Packs cost ",
            LibString.toString(packPrice),
            " quote units. Low pays 95% and can always be bought; Medium (30-150%) and High (10-300%) average 90% and can be bought while the pool covers their top prize. Presale packs share the presale reserve. Cards hold bStocks bought at Atlas prices from ",
            LibString.toHexString(market),
            "; burn a card to take its stock. Nobody can withdraw the pool. Pool: ",
            LibString.toString(pool),
            ", presale reserve: ",
            LibString.toString(presaleReserve),
            "."
        );
    }

    /// @inheritdoc DirectLaunchVaultBase
    function vaultUISchema() public pure override returns (VaultUISchema memory schema) {
        schema.vaultType = "PackVault";
        schema.description = "Stock packs: open packs into cards holding a bStock, stake cards to earn tax, burn cards to take the stock.";
        schema.methods = new VaultMethodSchema[](8);

        schema.methods[0].name = "packsOf";
        schema.methods[0].description = "Unopened packs: presale, Low, Medium, High.";
        schema.methods[0].inputs = new FieldDescriptor[](1);
        schema.methods[0].inputs[0] = FieldDescriptor("account", "address", "Holder", 0);
        schema.methods[0].outputs = new FieldDescriptor[](4);
        schema.methods[0].outputs[0] = FieldDescriptor("presale", "uint256", "Presale packs", 0);
        schema.methods[0].outputs[1] = FieldDescriptor("low", "uint256", "Low packs", 0);
        schema.methods[0].outputs[2] = FieldDescriptor("medium", "uint256", "Medium packs", 0);
        schema.methods[0].outputs[3] = FieldDescriptor("high", "uint256", "High packs", 0);

        schema.methods[1].name = "pool";
        schema.methods[1].description = "Stock pool that pays Medium and High prizes.";
        schema.methods[1].outputs = new FieldDescriptor[](1);
        schema.methods[1].outputs[0] = FieldDescriptor("amount", "uint256", "Pool", 18);

        schema.methods[2].name = "buy";
        schema.methods[2].description = "Buy packs of a tier (0 Low, 1 Medium, 2 High).";
        schema.methods[2].inputs = new FieldDescriptor[](3);
        schema.methods[2].inputs[0] = FieldDescriptor("tier", "uint8", "0 Low, 1 Medium, 2 High", 0);
        schema.methods[2].inputs[1] = FieldDescriptor("quantity", "uint256", "Packs (1-20)", 0);
        schema.methods[2].inputs[2] = FieldDescriptor("value", "msg.value", "quantity x pack price (native quote)", 18);
        schema.methods[2].isWriteMethod = true;

        schema.methods[3].name = "open";
        schema.methods[3].description = "Open a pack (0-2 bought tier, 3 presale); reveal from the next block.";
        schema.methods[3].inputs = new FieldDescriptor[](1);
        schema.methods[3].inputs[0] = FieldDescriptor("kind", "uint8", "0 Low, 1 Medium, 2 High, 3 presale", 0);
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

        schema.methods[6].name = "earned";
        schema.methods[6].description = "Staking rewards an account can collect.";
        schema.methods[6].inputs = new FieldDescriptor[](1);
        schema.methods[6].inputs[0] = FieldDescriptor("account", "address", "Staker", 0);
        schema.methods[6].outputs = new FieldDescriptor[](1);
        schema.methods[6].outputs[0] = FieldDescriptor("amount", "uint256", "Rewards", 18);

        schema.methods[7].name = "claimRewards";
        schema.methods[7].description = "Collect staking rewards.";
        schema.methods[7].isWriteMethod = true;
    }
}
