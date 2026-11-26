// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "solady/tokens/ERC20.sol";
import {LibClone} from "solady/utils/LibClone.sol";
import {MockStockMarket} from "src/stocks/MockStockMarket.sol";
import {MockBStock} from "src/stocks/MockBStock.sol";
import {PackVault} from "src/packs/PackVault.sol";
import {PackBasket, PackOdds} from "src/packs/PackTypes.sol";
import {LaunchVaultAddresses} from "src/flap/LaunchVaultAddresses.sol";

/// @dev Chainlink-style feed with 8 decimals, standing in for Atlas BNB/USD.
contract MockFeed {
    int256 public answer = 500e8;

    function decimals() external pure returns (uint8) {
        return 8;
    }

    function set(int256 a) external {
        answer = a;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (1, answer, block.timestamp, block.timestamp, 1);
    }
}

/// @dev Free-mint 18-decimal token standing in for Flap's testnet USD.
contract MockUSD is ERC20 {
    function name() public pure override returns (string memory) {
        return "USD";
    }

    function symbol() public pure override returns (string memory) {
        return "USD";
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev Stands in for `PackLauncher`: the vault only reads these, and the launcher funds the presale reserve.
contract FakeLauncher {
    address public creator;
    address public quoteToken;
    uint256 public packsForSale;
    mapping(address => uint256) public packsOf;

    constructor(address creator_, address quote_, uint256 packsForSale_) {
        creator = creator_;
        quoteToken = quote_;
        packsForSale = packsForSale_;
    }

    function name() external pure returns (string memory) {
        return "Chip Rush";
    }

    function setPacks(address a, uint256 n) external {
        packsOf[a] = n;
    }

    function fund(PackVault v, uint256 amount) external payable {
        if (quoteToken == address(0)) {
            v.fundPresale{value: amount}(amount);
        } else {
            ERC20(quoteToken).approve(address(v), amount);
            v.fundPresale(amount);
        }
    }

    receive() external payable {}
}

/// @notice The vault on its own (no Portal), for a BNB-quoted coin. `PackVaultUSDTest` reruns everything in USD.
contract PackVaultTest is Test {
    MockFeed feed;
    MockStockMarket market;
    MockUSD usd;
    address nvda;
    address amd;
    FakeLauncher launcher;
    PackVault vault;

    address owner = makeAddr("owner");
    address creator = makeAddr("creator");
    address platform = makeAddr("platform");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address taxer = makeAddr("taxer");
    uint256 constant PRESALE_PACKS = 10;

    function _quote() internal view virtual returns (address) {
        return address(0);
    }

    /// Pack price in quote units: 0.01 BNB, or 5 USD.
    function _price() internal view virtual returns (uint256) {
        return 0.01 ether;
    }

    function setUp() public {
        feed = new MockFeed();
        usd = new MockUSD();
        market = new MockStockMarket(owner, address(feed));
        vm.startPrank(owner);
        market.setQuote(address(usd), 1e18);
        nvda = market.list("NVIDIA bStock", "NVDAB", 125 ether);
        amd = market.list("AMD bStock", "AMDB", 100 ether);
        vm.stopPrank();

        launcher = new FakeLauncher(creator, _quote(), PRESALE_PACKS);
        vault = _newVault();
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.deal(taxer, 1000 ether);
        vm.deal(address(launcher), 100 ether);
        usd.mint(alice, 100_000 ether);
        usd.mint(bob, 100_000 ether);
        usd.mint(taxer, 1_000_000 ether);
        usd.mint(address(launcher), 100_000 ether);
        vm.prank(alice);
        usd.approve(address(vault), type(uint256).max);
        vm.prank(bob);
        usd.approve(address(vault), type(uint256).max);
    }

    function _newVault() internal returns (PackVault v) {
        address[] memory stocks = new address[](2);
        stocks[0] = nvda;
        stocks[1] = amd;
        uint16[] memory weights = new uint16[](2);
        weights[0] = 6000;
        weights[1] = 4000;
        v = PackVault(payable(LibClone.deployERC1967(address(new PackVault()))));
        v.initialize(makeAddr("token"), address(launcher), PackBasket(address(market), stocks, weights), _price(), _quote(), platform);
    }

    // ── helpers ──

    function _tax(uint256 amount) internal {
        if (_quote() == address(0)) {
            vm.prank(taxer);
            (bool ok,) = address(vault).call{value: amount}("");
            assertTrue(ok);
        } else {
            vm.prank(taxer);
            usd.transfer(address(vault), amount);
            (bool ok,) = address(vault).call(""); // the ping
            assertTrue(ok);
        }
    }

    function _buy(address who, uint8 tier, uint256 n) internal {
        uint256 cost = _price() * n;
        vm.prank(who);
        if (_quote() == address(0)) vault.buy{value: cost}(tier, n);
        else vault.buy(tier, n);
    }

    function _openReveal(address who, uint8 kind) internal returns (uint256 cardId) {
        vm.prank(who);
        uint256 id = vault.open(kind);
        vm.roll(block.number + 2);
        cardId = vault.reveal(id);
    }

    function _bal(address who) internal view returns (uint256) {
        return _quote() == address(0) ? who.balance : usd.balanceOf(who);
    }

    function _accounted() internal view returns (uint256) {
        return vault.pool() + vault.reserved() + vault.presaleReserve() + vault.creatorOwed() + vault.platformOwed()
            + vault.stakePot();
    }

    function _assertSolvent() internal view {
        assertGe(_bal(address(vault)), _accounted(), "balance covers every bucket");
    }

    // ── odds ──

    function test_oddsTables() public pure {
        uint256 sum;
        uint16[10] memory low = PackOdds.table(PackOdds.LOW);
        for (uint256 i; i < 10; ++i) {
            assertEq(low[i], 9500);
        }
        for (uint8 t = 1; t < PackOdds.TIERS; ++t) {
            uint16[10] memory tab = PackOdds.table(t);
            sum = 0;
            for (uint256 i; i < 10; ++i) {
                sum += tab[i];
            }
            assertEq(sum, 90_000, "Medium and High average 90%");
        }
    }

    // ── tiers ──

    function test_lowAlwaysBuyableFromAnEmptyPool() public {
        assertEq(vault.pool(), 0);
        _buy(alice, PackOdds.LOW, 3);
        (, uint256 low,,) = vault.packsOf(alice);
        assertEq(low, 3);
        // 5% margin of each Low pack joins the pool.
        assertEq(vault.pool(), _price() * 3 * 500 / 10_000);
        uint256 card = _openReveal(alice, PackOdds.LOW);
        (,, uint16 bps, uint256 value,) = vault.cards(card);
        assertEq(bps, 9500);
        assertEq(value, _price() * 9500 / 10_000);
        _assertSolvent();
    }

    function test_mediumAndHighUnlockAsThePoolGrows() public {
        assertFalse(vault.canBuy(PackOdds.MEDIUM, 1));
        uint256 cost = _price();
        uint256 need = vault.poolNeeded(PackOdds.MEDIUM, 1);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(PackVault.TierLocked.selector, uint8(1), 0, need));
        if (_quote() == address(0)) vault.buy{value: cost}(PackOdds.MEDIUM, 1);
        else vault.buy(PackOdds.MEDIUM, 1);

        // Tax arrives: half joins the pool. A little unlocks Medium (needs 0.5x price); High needs 2x price.
        _tax(_price());
        assertTrue(vault.canBuy(PackOdds.MEDIUM, 1));
        assertFalse(vault.canBuy(PackOdds.HIGH, 1));
        _tax(_price() * 4);
        assertTrue(vault.canBuy(PackOdds.HIGH, 1));
        _buy(alice, PackOdds.MEDIUM, 1);
        _buy(alice, PackOdds.HIGH, 1);
        _openReveal(alice, PackOdds.MEDIUM);
        _openReveal(alice, PackOdds.HIGH);
        _assertSolvent();
    }

    function test_boughtPacksAlwaysOpen_topPrizeSetAside() public {
        _tax(_price() * 20);
        _buy(alice, PackOdds.HIGH, 5);
        assertEq(vault.reserved(), vault.maxPayout(PackOdds.HIGH) * 5);
        for (uint256 i; i < 5; ++i) {
            _openReveal(alice, PackOdds.HIGH);
        }
        assertEq(vault.reserved(), 0);
        _assertSolvent();
    }

    // ── revenue ──

    function test_taxSplits50_30_15_5() public {
        _tax(1000 ether / (_quote() == address(0) ? 1000 : 1));
        vault.sync();
        uint256 t = 1000 ether / (_quote() == address(0) ? 1000 : 1);
        assertEq(vault.pool(), t * 5000 / 10_000);
        assertEq(vault.stakePot(), t * 3000 / 10_000);
        assertEq(vault.creatorOwed(), t * 1500 / 10_000);
        assertEq(vault.platformOwed(), t * 500 / 10_000);
        assertEq(_accounted(), t);
    }

    function test_creatorAndPlatformClaim_guardianCanTrigger() public {
        _tax(_price() * 10);
        uint256 creatorBefore = _bal(creator);
        vm.prank(creator);
        vault.claimCreator();
        assertEq(_bal(creator) - creatorBefore, _price() * 10 * 1500 / 10_000);

        uint256 platformBefore = _bal(platform);
        vm.prank(LaunchVaultAddresses.guardian());
        vault.claimPlatform(); // the Guardian triggers it; the platform is paid
        assertEq(_bal(platform) - platformBefore, _price() * 10 * 500 / 10_000);

        vm.prank(alice);
        vm.expectRevert(PackVault.Unauthorized.selector);
        vault.claimCreator();
    }

    // ── presale ──

    function test_presalePacksShareTheReserveExactly() public {
        launcher.setPacks(alice, 4);
        launcher.setPacks(bob, 6);
        uint256 seed = _price() * 3; // 30% of a 10-pack raise
        launcher.fund{value: _quote() == address(0) ? seed : 0}(vault, seed);
        assertEq(vault.presaleReserve(), seed);
        assertEq(vault.presalePacksOf(alice), 4);

        uint256 paid;
        for (uint256 i; i < 4; ++i) {
            (,,, uint256 v,) = vault.cards(_openReveal(alice, PackVault(payable(vault)).PRESALE()));
            paid += v;
        }
        for (uint256 i; i < 6; ++i) {
            (,,, uint256 v,) = vault.cards(_openReveal(bob, 3));
            paid += v;
        }
        assertEq(paid, seed, "presale packs pay out exactly the reserve");
        assertEq(vault.presaleReserve(), 0);
        assertEq(vault.presalePacksOf(alice), 0);
        _assertSolvent();
    }

    function test_onlyTheLauncherFundsThePresale_once() public {
        vm.prank(alice);
        vm.expectRevert(PackVault.OnlyLauncher.selector);
        vault.fundPresale(1);

        launcher.fund{value: _quote() == address(0) ? 1 ether : 0}(vault, 1 ether);
        vm.expectRevert(PackVault.AlreadyFunded.selector);
        launcher.fund{value: _quote() == address(0) ? 1 ether : 0}(vault, 1 ether);
    }

    function test_presaleSeedIsNotCountedAsTax() public {
        launcher.setPacks(alice, 1);
        launcher.fund{value: _quote() == address(0) ? 1 ether : 0}(vault, 1 ether);
        vault.sync();
        assertEq(vault.pool(), 0);
        assertEq(vault.creatorOwed(), 0);
    }

    // ── staking ──

    function test_stakersEarnTheirShareByValue_overSevenDays() public {
        _tax(_price() * 2); // unlock the pool a little
        _buy(alice, PackOdds.LOW, 1);
        _buy(bob, PackOdds.LOW, 2);
        uint256 a = _openReveal(alice, PackOdds.LOW);
        uint256 b1 = _openReveal(bob, PackOdds.LOW);
        uint256 b2 = _openReveal(bob, PackOdds.LOW);
        uint256[] memory ids = new uint256[](1);
        ids[0] = a;
        vm.prank(alice);
        vault.stake(ids);
        ids = new uint256[](2);
        ids[0] = b1;
        ids[1] = b2;
        vm.prank(bob);
        vault.stake(ids);
        assertEq(vault.ownerOf(a), address(vault), "staked cards sit in the vault");

        uint256 potBefore = vault.stakePot();
        uint256 t = _price() * 100;
        _tax(t);
        vault.sync();
        uint256 newRewards = vault.stakePot() - potBefore;
        assertEq(newRewards, t * 3000 / 10_000);

        vm.warp(block.timestamp + 7 days);
        uint256 ea = vault.earned(alice);
        uint256 eb = vault.earned(bob);
        // Bob staked twice Alice's value, so earns twice as much; together they get (almost) everything streamed.
        assertApproxEqRel(eb, ea * 2, 0.001e18);
        assertApproxEqRel(ea + eb, vault.stakePot(), 0.001e18);

        uint256 before = _bal(alice);
        vm.prank(alice);
        vault.claimRewards();
        assertEq(_bal(alice) - before, ea);
        _assertSolvent();
    }

    function test_rewardsWaitWhileNobodyStakes() public {
        _tax(_price() * 10);
        vault.sync();
        assertEq(vault.queued(), vault.stakePot());
        _buy(alice, PackOdds.LOW, 1);
        uint256 card = _openReveal(alice, PackOdds.LOW);
        uint256[] memory ids = new uint256[](1);
        ids[0] = card;
        vm.prank(alice);
        vault.stake(ids);
        assertEq(vault.queued(), 0, "queued rewards start streaming at the first stake");
        vm.warp(block.timestamp + 7 days);
        assertApproxEqRel(vault.earned(alice), vault.stakePot(), 0.001e18);
    }

    function test_stakedCardsCantBeRedeemed_unstakeReturnsThem() public {
        _buy(alice, PackOdds.LOW, 1);
        uint256 card = _openReveal(alice, PackOdds.LOW);
        uint256[] memory ids = new uint256[](1);
        ids[0] = card;
        vm.startPrank(alice);
        vault.stake(ids);
        vm.expectRevert(abi.encodeWithSelector(PackVault.NotYourCard.selector, card));
        vault.redeem(card);
        vault.unstake(ids);
        assertEq(vault.ownerOf(card), alice);
        vault.redeem(card);
        vm.stopPrank();
        (address stock,,,, uint256 amount) = vault.cards(card);
        assertEq(MockBStock(stock).balanceOf(alice), amount);
    }

    // ── reveals and cards ──

    function test_revealWaitsForTheNextBlock_lateRevealPaysTheLowest() public {
        _tax(_price() * 10);
        _buy(alice, PackOdds.HIGH, 1);
        vm.prank(alice);
        uint256 id = vault.open(PackOdds.HIGH);
        vm.expectRevert(abi.encodeWithSelector(PackVault.RevealNotReady.selector, id));
        vault.reveal(id);
        vm.roll(block.number + 300);
        uint256 card = vault.reveal(id);
        (,, uint16 bps,,) = vault.cards(card);
        assertEq(bps, PackOdds.minBps(PackOdds.HIGH));
    }

    function test_cardHoldsTheStockItPaidFor() public {
        _buy(alice, PackOdds.LOW, 1);
        uint256 card = _openReveal(alice, PackOdds.LOW);
        (address stock,,, uint256 value, uint256 amount) = vault.cards(card);
        assertEq(amount, value * 1e18 / market.priceIn(stock, _quote()));
        assertEq(MockBStock(stock).balanceOf(address(vault)), amount);
        assertGt(bytes(vault.tokenURI(card)).length, 50);
        assertGt(bytes(vault.description()).length, 100);
    }

    function test_manyRandomActionsStaySolvent() public {
        launcher.setPacks(alice, 10);
        launcher.fund{value: _quote() == address(0) ? _price() * 3 : 0}(vault, _price() * 3);
        for (uint256 i; i < 30; ++i) {
            _tax(_price() / 2);
            _buy(bob, PackOdds.LOW, 1);
            _openReveal(bob, PackOdds.LOW);
            if (vault.canBuy(PackOdds.HIGH, 1)) {
                _buy(bob, PackOdds.HIGH, 1);
                _openReveal(bob, PackOdds.HIGH);
            }
            if (i < 10) _openReveal(alice, 3);
            _assertSolvent();
        }
    }

    // ── market ──

    function test_marketPricesInBnbAndUsd() public {
        assertEq(market.priceIn(nvda, address(0)), 0.25 ether); // $125 at $500/BNB
        assertEq(market.priceIn(nvda, address(usd)), 125 ether); // 125 USD
        feed.set(1000e8);
        assertEq(market.priceIn(nvda, address(0)), 0.125 ether);
        assertEq(market.priceIn(nvda, address(usd)), 125 ether);
        assertEq(market.priceIn(nvda, makeAddr("nope")), 0);
        feed.set(0);
        vm.expectRevert(MockStockMarket.BadFeed.selector);
        market.priceIn(nvda, address(0));
    }
}

/// @notice Every vault test again, for a USD-quoted coin (5 USD packs).
contract PackVaultUSDTest is PackVaultTest {
    function _quote() internal view override returns (address) {
        return address(usd);
    }

    function _price() internal pure override returns (uint256) {
        return 5 ether;
    }
}
