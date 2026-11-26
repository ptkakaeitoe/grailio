// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPortalTypes, IPortal} from "src/flap/IPortal.sol";
import {Initializable} from "@openzeppelin-contracts-upgradeable/proxy/utils/Initializable.sol";
import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";
import {LauncherBase} from "src/flap/LauncherBase.sol";
import {Distribution, DistributionTarget} from "src/flap/Distribution.sol";
import {IStrategy} from "src/flap/IStrategy.sol";
import {LaunchExtensionHelper} from "src/flap/LaunchExtensionHelper.sol";
import {LauncherDescription} from "src/flap/LauncherHelper.sol";
import {PackBasket} from "./PackTypes.sol";

interface IPackVaultFunding {
    function fundPresale(uint256 amount) external payable;
}

string constant PACK_TITLE_ZH = unicode"股票卡包预售";
string constant PACK_TITLE_EN = "Stock pack presale";
string constant PACK_SUMMARY_ZH =
    unicode"发射前先预售卡包。卡包售罄后代币发射：大部分募集资金进入流动性池，其余成为预售卡包的奖池，买家按卡包数量分得 50% 的代币供应。之后交易税按 50% 奖池、30% 卡牌质押者、15% 创建者、5% 平台分配。卡包开出持有代币化股票的卡牌 NFT，可质押赚取税收，销毁即可取出股票。未售罄则可退款。";
string constant PACK_SUMMARY_EN =
    "Packs sell before the coin exists. When they sell out the coin launches: most of the raise seeds the pool, the rest funds the presale packs' prizes, and buyers split 50% of the supply by packs held, at the same price the pool opens at. The trading tax then goes 50% to the stock pool, 30% to card stakers, 15% to the creator and 5% to the platform. Packs open into card NFTs that hold tokenized stocks; stake a card to earn tax, burn it to take the stock. If the packs do not sell out, buyers are refunded.";

/// @notice Payload for `Portal.newLauncher(factory, abi.encode(PackConfig))`.
/// @param name          Coin name.
/// @param symbol        Coin symbol.
/// @param meta          Metadata URI.
/// @param salt          Launch salt, mined so the token address ends in `0x7777`.
/// @param quoteToken    address(0) for native BNB, or an ERC20 quote the vault factory supports (for example USD).
/// @param packPrice     Quote per presale pack (and per pack bought from the vault later).
/// @param packsForSale  Presale size. `packPrice * packsForSale` is the raise.
/// @param saleDuration  Presale window in seconds.
/// @param vaultFactory  The paired `PackVaultFactory`.
/// @param seedBps       Share of the raise that funds the presale packs' prizes (0-5000); the rest seeds liquidity.
/// @param basket        The stocks the packs draw from.
struct PackConfig {
    string name;
    string symbol;
    string meta;
    bytes32 salt;
    address quoteToken;
    uint256 packPrice;
    uint256 packsForSale;
    uint256 saleDuration;
    address vaultFactory;
    uint16 seedBps;
    PackBasket basket;
}

/// @title PackLauncher
/// @notice Pre-launch stock pack presale, paired with `PackVault`.
///
///           LAUNCHER (before the DEX)                      VAULT (after the DEX)
///           buyPacks() ──┐                                 all tax ─► PackVault (50/30/15/5)  
///           buyPacks() ──┤ sold out                        open() / reveal() ─► card NFT holding a bStock
///                        ▼                                 redeem() ─► the bStock
///                    _launch() ─► Portal ─► token + pool + PackVault
///                        │  seedBps of the raise ─► presale reserve
///                  50% of supply here: buyers claim() by packs held
///
///         Presale packs are read by the vault from `packsOf`, so they can be opened there as soon as the pool
///         covers a pack's top prize. Once sold out nothing here changes: no more packs, no refunds.
///
/// @dev Deployed by `PackLauncherFactory` as an ERC1967 beacon proxy.
contract PackLauncher is LauncherBase, Initializable, IStrategy {
    using SafeTransferLib for address;

    uint256 public constant TOTAL_SUPPLY = 1_000_000 ether;
    /// @dev Half the supply seeds the pool and half goes to presale buyers, so presale buyers pay exactly the price the
    ///      pool opens at: their coins at that price plus their share of the presale reserve equal what they paid.
    uint256 public constant POOL_TOKEN = TOTAL_SUPPLY / 2;
    uint256 internal constant DISTRIBUTED_TOKEN = TOTAL_SUPPLY - POOL_TOKEN;
    uint256 public constant MAX_BUY = 50;

    address public hub;
    address public creator;
    bytes32 public launchSalt;
    address public quoteToken;
    uint256 public packPrice;
    uint256 public packsForSale;
    uint256 public saleDeadline;
    address public vaultFactory;
    uint16 public seedBps;
    PackBasket internal _basket;

    string public name;
    string public symbol;
    string public meta;

    uint256 public packsSold;
    mapping(address account => uint256 count) public packsOf;

    bool public launched;
    /// @notice True only while the Portal launch call runs; the vault factory checks it.
    bool public launching;
    bool internal distributionInitialized;

    address public token;
    address public pool;
    address public vault;
    mapping(address account => uint256 amount) public claimed;

    event PacksBought(address indexed buyer, uint256 quantity, uint256 paid);
    event Launched(address indexed token, address indexed pool, address indexed vault, uint256 seed);
    event Claimed(address indexed account, uint256 amount);
    event Refunded(address indexed account, uint256 amount);

    error InvalidConfig();
    error SaleClosed();
    error BadQuantity();
    error WrongPayment(uint256 sent, uint256 expected);
    error SoldOut(uint256 left);
    error LaunchInProgress();
    error UnauthorizedDistribution();
    error NotLaunched();
    error NothingToClaim();
    error RefundUnavailable();
    error NothingToRefund();
    error NoVault();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address hub_, address creator_, PackConfig calldata c) external payable initializer {
        if (hub_ == address(0) || creator_ == address(0) || c.vaultFactory == address(0)) revert InvalidConfig();
        if (c.salt == bytes32(0) || c.packPrice == 0 || c.packsForSale == 0 || c.saleDuration == 0) {
            revert InvalidConfig();
        }

        hub = hub_;
        creator = creator_;
        launchSalt = c.salt;
        quoteToken = c.quoteToken;
        packPrice = c.packPrice;
        packsForSale = c.packsForSale;
        saleDeadline = block.timestamp + c.saleDuration;
        vaultFactory = c.vaultFactory;
        seedBps = c.seedBps;
        _basket = c.basket;
        name = c.name;
        symbol = c.symbol;
        meta = c.meta;

        uint256 fee = IPortal(hub_).SALT_LOCK_FEE();
        if (msg.value != fee) revert InvalidConfig();
        IPortal(hub_).lockSalt{value: fee}(c.salt, uint8(IPortalTypes.LaunchKind.DIRECT_V2_POOL_TAX));
    }

    function _getHub() internal view override returns (address) {
        return hub;
    }

    /// @notice The raise: every presale pack sold.
    function targetRaise() public view returns (uint256) {
        return packPrice * packsForSale;
    }

    /// @notice The part of the raise that seeds the vault's stock pool.
    function seedAmount() public view returns (uint256) {
        return targetRaise() * seedBps / 10_000;
    }

    function basket() external view returns (PackBasket memory) {
        return _basket;
    }

    /// @inheritdoc LauncherBase
    function _description() internal view override returns (LauncherDescription memory d) {
        d.name = name;
        d.symbol = symbol;
        d.quoteToken = quoteToken;
        d.targetRaise = targetRaise();
        d.poolTokenRatio = (POOL_TOKEN * 1e18) / TOTAL_SUPPLY;
        d.titleZh = PACK_TITLE_ZH;
        d.titleEn = PACK_TITLE_EN;
        d.summaryZh = PACK_SUMMARY_ZH;
        d.summaryEn = PACK_SUMMARY_EN;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Presale
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Buy presale packs. Native: send quantity × price. ERC20: approve this Launcher first. The purchase that
    ///         sells the last pack launches the coin in the same transaction.
    function buyPacks(uint256 quantity) external payable {
        if (launching) revert LaunchInProgress();
        if (launched || block.timestamp >= saleDeadline) revert SaleClosed();
        if (quantity == 0 || quantity > MAX_BUY) revert BadQuantity();
        uint256 left = packsForSale - packsSold;
        if (quantity > left) revert SoldOut(left);
        uint256 cost = quantity * packPrice;
        if (quoteToken == address(0)) {
            if (msg.value != cost) revert WrongPayment(msg.value, cost);
        } else {
            if (msg.value != 0) revert WrongPayment(msg.value, 0);
            quoteToken.safeTransferFrom(msg.sender, address(this), cost);
        }

        packsSold += quantity;
        packsOf[msg.sender] += quantity;
        emit PacksBought(msg.sender, quantity, cost);

        if (packsSold == packsForSale) _launch();
    }

    /// @notice After a presale that did not sell out, take your BNB back.
    function refund() external {
        if (launched || packsSold == packsForSale || block.timestamp < saleDeadline) revert RefundUnavailable();
        uint256 count = packsOf[msg.sender];
        if (count == 0) revert NothingToRefund();
        packsOf[msg.sender] = 0;
        packsSold -= count;
        uint256 amount = count * packPrice;
        if (quoteToken == address(0)) msg.sender.safeTransferETH(amount);
        else quoteToken.safeTransfer(msg.sender, amount);
        emit Refunded(msg.sender, amount);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Launch
    // ─────────────────────────────────────────────────────────────────────────

    function _launch() private {
        uint256 seed = seedAmount();
        IPortalTypes.CreateTaxTokenParams memory p = _buildParams(targetRaise() - seed);
        Distribution memory dist = Distribution({
            target: DistributionTarget.EXPLICIT,
            strategy: address(this),
            amount: uint128(DISTRIBUTED_TOKEN),
            configData: ""
        });
        IPortalTypes.CreatorBuyParams memory creatorBuy;

        launching = true;
        address token_;
        address pool_;
        if (quoteToken == address(0)) {
            (token_, pool_) = IPortal(hub).launchTaxTokenV2{value: p.poolQuote}(p, dist, creatorBuy);
        } else {
            quoteToken.safeApprove(hub, p.poolQuote);
            (token_, pool_) = IPortal(hub).launchTaxTokenV2(p, dist, creatorBuy);
            quoteToken.safeApprove(hub, 0);
        }
        launching = false;

        (address vault_,) = IPortal(hub).getLaunchVault(token_);
        if (vault_ == address(0)) revert NoVault();
        launched = true;
        token = token_;
        pool = pool_;
        vault = vault_;
        if (seed > 0) {
            if (quoteToken == address(0)) {
                IPackVaultFunding(vault_).fundPresale{value: seed}(seed);
            } else {
                quoteToken.safeApprove(vault_, seed);
                IPackVaultFunding(vault_).fundPresale(seed);
            }
        }
        emit Launched(token_, pool_, vault_, seed);
    }

    /// @inheritdoc IStrategy
    function initializeDistribution(address token_, uint256 amount, bytes calldata, bytes32) external override onlyHub {
        if (!launching || distributionInitialized) revert UnauthorizedDistribution();
        if (token_ == address(0) || amount != DISTRIBUTED_TOKEN) revert InvalidConfig();
        distributionInitialized = true;
        token = token_;
        token_.safeTransferFrom(msg.sender, address(this), amount);
        emit FlapDistributionInitialized(token_, amount);
    }

    /// @notice Claim your share of the reserved half of the supply: by presale packs bought.
    function claim() external {
        if (!launched) revert NotLaunched();
        uint256 entitled = (packsOf[msg.sender] * DISTRIBUTED_TOKEN) / packsForSale;
        uint256 amount = entitled - claimed[msg.sender];
        if (amount == 0) revert NothingToClaim();
        claimed[msg.sender] = entitled;
        token.safeTransfer(msg.sender, amount);
        emit Claimed(msg.sender, amount);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Launch parameters
    // ─────────────────────────────────────────────────────────────────────────

    function _buildParams(uint256 poolQuote) private view returns (IPortalTypes.CreateTaxTokenParams memory p) {
        p.name = name;
        p.symbol = symbol;
        p.meta = meta;
        p.totalSupply = TOTAL_SUPPLY;
        p.salt = launchSalt;
        p.quoteToken = quoteToken;
        p.dexId = 0;
        p.poolQuote = poolQuote;
        p.poolToken = POOL_TOKEN;
        p.buyTaxRate = 300;
        p.sellTaxRate = 300;
        p.taxDuration = type(uint32).max; // the longest the Portal accepts: the stock pool keeps refilling
        p.antiFarmerDuration = 1 days;
        p.feeConfigs = _feeConfigs();
        p.exemptAddrs = new address[](0);
        (p.extensionID, p.extensionData) = LaunchExtensionHelper.encodeCreator(creator);
    }

    /// @dev All of the tax goes to the PackVault, which splits it 50% pool / 30% stakers / 15% creator / 5% platform.
    function _feeConfigs() private view returns (IPortalTypes.FeeConfig[] memory fees) {
        fees = new IPortalTypes.FeeConfig[](1);
        fees[0] = IPortalTypes.FeeConfig({
            feeType: IPortalTypes.FeeSlotType.VAULT,
            bps: 10_000,
            configData: abi.encode(
                IPortalTypes.FeeConfigVault({
                    vaultFactory: vaultFactory, vaultData: abi.encode(address(this), _basket, packPrice)
                })
            )
        });
    }
}
