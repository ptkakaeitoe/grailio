// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Vm} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/token/ERC20/IERC20.sol";
import {IPortalTypes} from "src/flap/IPortal.sol";
import {Distribution} from "src/flap/Distribution.sol";
import {MockStockMarket} from "src/stocks/MockStockMarket.sol";
import {MockBStock} from "src/stocks/MockBStock.sol";
import {PackLauncher, PackConfig} from "src/packs/PackLauncher.sol";
import {PackLauncherFactory} from "src/packs/PackLauncherFactory.sol";
import {PackVault} from "src/packs/PackVault.sol";
import {PackVaultFactory} from "src/packs/PackVaultFactory.sol";
import {PackBasket, PackOdds} from "src/packs/PackTypes.sol";
import {ForkBase} from "test/ForkBase.sol";
import {ForkAddresses} from "test/ForkAddresses.sol";

interface ITestUSD {
    function mint(address to, uint256 amount) external;
}

interface ITokenRouter {
    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external;
}

interface ITaxTokenView {
    function taxProcessor() external view returns (address);
}

interface ITaxProcessorView {
    function dispatch() external;
    function feeQuoteBalance() external view returns (uint256);
    function marketQuoteBalance() external view returns (uint256);
    function pendingDividendQuoteTokenBalance() external view returns (uint256);
    function lpQuoteBalance() external view returns (uint256);
}

/// @notice The pack Launcher + Vault on a live BNB Testnet Portal, for a BNB-quoted and a USD-quoted coin: presale,
///         launch, token claims, tax into the vault and its split, presale packs, tiers, staking, redeem.
///         Needs `BSC_TESTNET_RPC_URL`; skipped without it.
contract PackBSCTestForkTest is ForkBase {
    MockStockMarket internal market;
    address internal nvda;
    address internal amd;
    PackVaultFactory internal vaultFactory;
    PackLauncherFactory internal launcherFactory;
    address internal platform = address(uint160(0xC0DE0005));

    /// @dev Atlas's on-chain BNB/USD feed and Flap's free-mint testnet USD on BNB Testnet.
    address internal constant ATLAS_BNB_USD = 0x3957d289ee9C38272377786787ea34F9dd29788D;
    address internal constant USD = 0x190C989D5665a0e404B444b53CAE9AbCfb600157;
    uint256 internal constant PACKS = 10;

    function _addrs() internal pure override returns (ForkAddresses.Addrs memory) {
        return ForkAddresses.bscTest();
    }

    function _deploy() internal {
        market = new MockStockMarket(address(this), ATLAS_BNB_USD);
        market.setQuote(USD, 1e18);
        nvda = market.list("NVIDIA bStock", "NVDAB", 150 ether);
        amd = market.list("AMD bStock", "AMDB", 120 ether);

        uint256 nonce = vm.getNonce(address(this));
        address predicted = vm.computeCreateAddress(address(this), nonce + 1);
        vaultFactory = new PackVaultFactory(predicted, address(market), platform);
        launcherFactory = new PackLauncherFactory(portalAddr, guardian, address(vaultFactory));
        assertEq(address(launcherFactory), predicted, "address prediction held");
    }

    function _basket() internal view returns (PackBasket memory b) {
        b.market = address(market);
        b.stocks = new address[](2);
        b.stocks[0] = nvda;
        b.stocks[1] = amd;
        b.weights = new uint16[](2);
        b.weights[0] = 6000;
        b.weights[1] = 4000;
    }

    /// @dev BNB: 10 packs of 0.35 BNB. USD: 10 packs of 220 USD. Either way 70% of the raise clears the 1x floor
    ///      ($1,500 of liquidity with half the supply in the pool).
    function _config(bytes32 seed, address quote) internal returns (PackConfig memory c) {
        c.name = "Chip Rush";
        c.symbol = "CHIP";
        c.meta = "bafkreig4y5nwb4izyilbbmiydumvkld446d4k7j4ohg3x3q2lfel3fo4yq";
        c.salt = _mineSalt(seed);
        c.quoteToken = quote;
        c.packPrice = quote == address(0) ? 0.35 ether : 220 ether;
        c.packsForSale = PACKS;
        c.saleDuration = 1 days;
        c.vaultFactory = address(vaultFactory);
        c.seedBps = 3000;
        c.basket = _basket();
    }

    function _buyPacks(PackLauncher l, address who, uint256 n) internal {
        uint256 cost = l.packPrice() * n;
        vm.startPrank(who);
        if (l.quoteToken() == address(0)) {
            l.buyPacks{value: cost}(n);
        } else {
            ITestUSD(USD).mint(who, cost);
            IERC20(USD).approve(address(l), cost);
            l.buyPacks(n);
        }
        vm.stopPrank();
    }

    function _quoteBal(address quote, address who) internal view returns (uint256) {
        return quote == address(0) ? who.balance : IERC20(USD).balanceOf(who);
    }

    function _taxLiq(address proc) internal view returns (bool) {
        ITaxProcessorView t = ITaxProcessorView(proc);
        return t.feeQuoteBalance() > 0 || t.marketQuoteBalance() > 0 || t.pendingDividendQuoteTokenBalance() > 0
            || t.lpQuoteBalance() > 0;
    }

    /// @dev USD-quoted pools trade token <-> USD; same idea as ForkBase's BNB helper.
    function _generateUsdTaxAndDispatch(address token) internal {
        vm.warp(block.timestamp + 601);
        address proc = ITaxTokenView(token).taxProcessor();
        vm.startPrank(trader);
        ITestUSD(USD).mint(trader, 100_000 ether);
        IERC20(USD).approve(v2Router, type(uint256).max);
        IERC20(token).approve(v2Router, type(uint256).max);
        address[] memory buyPath = new address[](2);
        buyPath[0] = USD;
        buyPath[1] = token;
        address[] memory sellPath = new address[](2);
        sellPath[0] = token;
        sellPath[1] = USD;
        ITokenRouter(v2Router).swapExactTokensForTokensSupportingFeeOnTransferTokens(
            20_000 ether, 0, buyPath, trader, block.timestamp + 600
        );
        for (uint256 i; i < 80 && !_taxLiq(proc); ++i) {
            uint256 amt = IERC20(token).balanceOf(trader) * 30 / 100;
            if (amt == 0) break;
            uint256 before_ = IERC20(USD).balanceOf(trader);
            ITokenRouter(v2Router).swapExactTokensForTokensSupportingFeeOnTransferTokens(
                amt, 0, sellPath, trader, block.timestamp + 600
            );
            uint256 got = IERC20(USD).balanceOf(trader) - before_;
            if (got > 0) {
                ITokenRouter(v2Router).swapExactTokensForTokensSupportingFeeOnTransferTokens(
                    got * 90 / 100, 0, buyPath, trader, block.timestamp + 600
                );
            }
        }
        vm.stopPrank();
        assertTrue(_taxLiq(proc), "tax never liquidated");
        ITaxProcessorView(proc).dispatch();
    }

    function _openReveal(PackVault vault, address who, uint8 kind) internal returns (uint256 cardId) {
        vm.prank(who);
        uint256 id = vault.open(kind);
        vm.roll(block.number + 2);
        cardId = vault.reveal(id);
    }

    /// @dev Like ForkBase's description check, for this launcher's quote and its 50% pool share.
    function _assertPackDescription(address launcher, PackConfig memory c, Vm.Log[] memory creation) internal view {
        string memory d = PackLauncher(payable(launcher)).description();
        assertEq(_launcherDescriptionFromLogs(creation, launcher), d, "the event carries the Launcher's own JSON");
        _assertContains(d, '{"v":1,"name":"', "v1 JSON");
        _assertContains(d, c.name, "name");
        _assertContains(d, string.concat('"quoteToken":"', vm.toLowercase(vm.toString(c.quoteToken)), '"'), "quote");
        _assertContains(d, string.concat('"targetRaise":"', vm.toString(c.packPrice * PACKS), '"'), "targetRaise");
        _assertContains(d, '"poolTokenRatio":"500000000000000000"', "half the supply seeds the pool");
    }

    function _journey(address quote, bytes32 seed) internal {
        _deploy();
        _openLauncherFactory(address(launcherFactory));

        PackConfig memory c = _config(seed, quote);
        vm.recordLogs();
        PackLauncher launcher = PackLauncher(payable(_newLauncher(address(launcherFactory), abi.encode(c))));
        Vm.Log[] memory creation = vm.getRecordedLogs();
        assertEq(portal.getLauncher(address(launcher)).launcherFactory, address(launcherFactory), "recorded");
        _assertPackDescription(address(launcher), c, creation);

        // Presale: alice 4 packs, bob 6; bob's purchase sells out and launches.
        _buyPacks(launcher, alice, 4);
        assertFalse(launcher.launched());
        _buyPacks(launcher, bob, 6);
        assertTrue(launcher.launched(), "launched on sell-out");

        address token = launcher.token();
        (address vaultAddr, address vf) = portal.getLaunchVault(token);
        assertEq(vf, address(vaultFactory));
        PackVault vault = PackVault(payable(vaultAddr));
        assertEq(vault.quote(), quote);
        assertEq(vault.platform(), platform);
        uint256 seedAmount = c.packPrice * PACKS * 3000 / 10_000;
        assertEq(vault.presaleReserve(), seedAmount, "seed funded the presale reserve");
        assertEq(_quoteBal(quote, address(launcher)), 0, "launcher keeps nothing");

        // Half the supply to presale buyers by packs.
        vm.prank(alice);
        launcher.claim();
        vm.prank(bob);
        launcher.claim();
        uint256 reserve = launcher.TOTAL_SUPPLY() - launcher.POOL_TOKEN();
        assertEq(reserve, launcher.TOTAL_SUPPLY() / 2);
        assertEq(IERC20(token).balanceOf(alice), reserve * 4 / 10);
        assertEq(IERC20(token).balanceOf(bob), reserve * 6 / 10);

        // Presale packs open right away and pay out exactly the reserve.
        assertEq(vault.presalePacksOf(alice), 4);
        uint256 paid;
        for (uint256 i; i < 4; ++i) {
            (,,, uint256 v,) = vault.cards(_openReveal(vault, alice, 3));
            paid += v;
        }
        for (uint256 i; i < 6; ++i) {
            (,,, uint256 v,) = vault.cards(_openReveal(vault, bob, 3));
            paid += v;
        }
        assertEq(paid, seedAmount);
        _afterLaunch(vault, token, quote, c.packPrice);
    }

    function _afterLaunch(PackVault vault, address token, address quote, uint256 price) internal {
        // Alice stakes a card before tax arrives.
        uint256[] memory ids = new uint256[](1);
        ids[0] = 1;
        assertEq(vault.ownerOf(1), alice);
        vm.prank(alice);
        vault.stake(ids);

        // Real trading tax reaches the vault and is split 50/30/15/5.
        if (quote == address(0)) _generateTaxAndDispatch(token);
        else _generateUsdTaxAndDispatch(token);
        uint256 incoming = vault.unrecognized();
        assertGt(incoming, 0, "the VAULT slot paid the vault");
        vault.sync();
        assertApproxEqAbs(vault.creatorOwed(), incoming * 1500 / 10_000, 2);
        assertApproxEqAbs(vault.platformOwed(), incoming * 500 / 10_000, 2);

        // A Low pack is always buyable.
        vm.startPrank(bob);
        if (quote == address(0)) {
            vault.buy{value: price}(PackOdds.LOW, 1);
        } else {
            ITestUSD(USD).mint(bob, price);
            IERC20(USD).approve(address(vault), price);
            vault.buy(PackOdds.LOW, 1);
        }
        vm.stopPrank();
        uint256 lowCard = _openReveal(vault, bob, PackOdds.LOW);
        (address stock,,, uint256 lowValue, uint256 amount) = vault.cards(lowCard);
        assertEq(lowValue, price * 9500 / 10_000);

        // Staking pays alice over the week; the creator claims.
        vm.warp(block.timestamp + 7 days);
        uint256 before = _quoteBal(quote, alice);
        vm.prank(alice);
        vault.claimRewards();
        assertGt(_quoteBal(quote, alice) - before, 0, "staker earned tax");
        vm.prank(creator);
        vault.claimCreator();

        // Redeem a card for its stock.
        vm.prank(bob);
        vault.redeem(lowCard);
        assertEq(MockBStock(stock).balanceOf(bob), amount);
    }

    function test_fullJourney_bnb() public {
        _journey(address(0), "pack-bnb");
    }

    function test_fullJourney_usd() public {
        _journey(USD, "pack-usd");
    }

    function test_refundWhenNotSoldOut_usd() public {
        _deploy();
        _openLauncherFactory(address(launcherFactory));
        PackLauncher launcher =
            PackLauncher(payable(_newLauncher(address(launcherFactory), abi.encode(_config("pack-refund", USD)))));
        _buyPacks(launcher, alice, 3);
        vm.warp(block.timestamp + 1 days);
        uint256 bal = IERC20(USD).balanceOf(alice);
        vm.prank(alice);
        launcher.refund();
        assertEq(IERC20(USD).balanceOf(alice), bal + 3 * 220 ether);
    }

    function test_factoryRejectsBadConfigs() public {
        _deploy();
        _openLauncherFactory(address(launcherFactory));
        uint256 fee = portal.SALT_LOCK_FEE();

        PackConfig memory c = _config("pack-bad-1", address(0));
        c.vaultFactory = address(0xdead);
        vm.prank(creator);
        vm.expectRevert(
            abi.encodeWithSelector(PackLauncherFactory.WrongVaultFactory.selector, address(0xdead), address(vaultFactory))
        );
        portal.newLauncher{value: fee}(address(launcherFactory), abi.encode(c));

        c = _config("pack-bad-2", address(0));
        c.basket.weights[0] = 5000;
        vm.prank(creator);
        vm.expectRevert(PackVaultFactory.BadBasket.selector);
        portal.newLauncher{value: fee}(address(launcherFactory), abi.encode(c));

        c = _config("pack-bad-3", address(0));
        c.basket.stocks[1] = address(0xbeef);
        vm.prank(creator);
        vm.expectRevert(abi.encodeWithSelector(PackVaultFactory.StockNotListed.selector, address(0xbeef)));
        portal.newLauncher{value: fee}(address(launcherFactory), abi.encode(c));

        c = _config("pack-bad-4", address(0));
        c.seedBps = 6000;
        vm.prank(creator);
        vm.expectRevert(abi.encodeWithSelector(PackLauncherFactory.SeedBpsOutOfRange.selector, 6000));
        portal.newLauncher{value: fee}(address(launcherFactory), abi.encode(c));

        c = _config("pack-bad-5", address(0xC0FFEE));
        vm.prank(creator);
        vm.expectRevert(abi.encodeWithSelector(PackLauncherFactory.UnsupportedQuote.selector, address(0xC0FFEE)));
        portal.newLauncher{value: fee}(address(launcherFactory), abi.encode(c));
    }

    function test_newVaultIsPortalOnly() public {
        _deploy();
        vm.startPrank(creator);
        vm.expectRevert(abi.encodeWithSignature("NotHub(address)", creator));
        vaultFactory.newVault(address(0x7777), creator, 0, "");
        vm.stopPrank();
    }

    function test_onlyTheGuardianUpgrades_andStateSurvives() public {
        _deploy();
        _openLauncherFactory(address(launcherFactory));
        PackLauncher launcher = PackLauncher(
            payable(_newLauncher(address(launcherFactory), abi.encode(_config("pack-upgrade", address(0)))))
        );
        _buyPacks(launcher, alice, 4);
        _buyPacks(launcher, bob, 6);
        PackVault vault = PackVault(payable(launcher.vault()));
        uint256 reserveBefore = vault.presaleReserve();

        address newLauncherImpl = address(new PackLauncher());
        address newVaultImpl = address(new PackVault());
        vm.startPrank(creator);
        vm.expectRevert(abi.encodeWithSignature("NotGuardian(address)", creator));
        launcherFactory.upgradeVaultImplementation(newLauncherImpl);
        vm.expectRevert(abi.encodeWithSignature("NotGuardian(address)", creator));
        vaultFactory.upgradeVaultImplementation(newVaultImpl);
        vm.stopPrank();

        vm.startPrank(guardian);
        launcherFactory.upgradeVaultImplementation(newLauncherImpl);
        vaultFactory.upgradeVaultImplementation(newVaultImpl);
        vm.stopPrank();
        assertEq(launcherFactory.beaconImplementation(), newLauncherImpl);
        assertEq(vaultFactory.beaconImplementation(), newVaultImpl);
        assertEq(launcher.packsOf(alice), 4);
        assertEq(vault.presalePacksOf(bob), 6);
        assertEq(vault.presaleReserve(), reserveBefore);
    }

    function test_descriptionStaysUnderThePortalLimit() public {
        _deploy();
        _openLauncherFactory(address(launcherFactory));
        PackConfig memory c = _config("pack-long-name", address(0));
        c.name = "A coin name that is long on purpose, long enough to test the description size limit ok";
        c.symbol = "LONGSYMBOL";
        PackLauncher launcher = PackLauncher(payable(_newLauncher(address(launcherFactory), abi.encode(c))));
        assertLt(bytes(launcher.description()).length, 4096, "Portal reads at most 4 KB");
    }

    function test_vaultFactoryRefusesAStrangerLauncher() public {
        _deploy();
        _openVaultFactory(address(vaultFactory));
        IPortalTypes.FeeConfig[] memory fees = new IPortalTypes.FeeConfig[](1);
        fees[0] = IPortalTypes.FeeConfig({
            feeType: IPortalTypes.FeeSlotType.VAULT,
            bps: 10_000,
            configData: abi.encode(
                IPortalTypes.FeeConfigVault({
                    vaultFactory: address(vaultFactory), vaultData: abi.encode(creator, _basket(), uint256(0.25 ether))
                })
            )
        });
        IPortalTypes.CreateTaxTokenParams memory p;
        p.name = "Stranger";
        p.symbol = "STR";
        p.meta = "bafkreig4y5nwb4izyilbbmiydumvkld446d4k7j4ohg3x3q2lfel3fo4yq";
        p.totalSupply = 1_000_000 ether;
        p.salt = _mineSalt("pack-stranger");
        p.poolQuote = 10 ether;
        p.poolToken = 1_000_000 ether;
        p.buyTaxRate = 300;
        p.sellTaxRate = 300;
        p.taxDuration = 30 days;
        p.antiFarmerDuration = 1 days;
        p.feeConfigs = fees;
        Distribution memory d;
        IPortalTypes.CreatorBuyParams memory noBuy;
        vm.prank(creator);
        vm.expectRevert(abi.encodeWithSelector(PackVaultFactory.NotFromLauncherFactory.selector, creator));
        portal.launchTaxTokenV2{value: 10 ether}(p, d, noBuy);
    }
}
