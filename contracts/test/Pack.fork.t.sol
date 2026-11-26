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
import {PackBasket} from "src/packs/PackTypes.sol";
import {ForkBase} from "test/ForkBase.sol";
import {ForkAddresses} from "test/ForkAddresses.sol";

/// @notice The pack Launcher + Vault on a live BNB Testnet Portal: presale, launch, token claims, tax into the vault,
///         packs opened into cards, cards redeemed. Needs `BSC_TESTNET_RPC_URL`; skipped without it.
contract PackBSCTestForkTest is ForkBase {
    MockStockMarket internal market;
    address internal nvda;
    address internal amd;
    PackVaultFactory internal vaultFactory;
    PackLauncherFactory internal launcherFactory;

    uint256 internal constant PRICE = 0.5 ether;
    /// @dev Atlas's on-chain BNB/USD feed on BNB Testnet.
    address internal constant ATLAS_BNB_USD = 0x3957d289ee9C38272377786787ea34F9dd29788D;
    uint256 internal constant PACKS = 10;

    function _addrs() internal pure override returns (ForkAddresses.Addrs memory) {
        return ForkAddresses.bscTest();
    }

    function _deploy() internal {
        market = new MockStockMarket(address(this), ATLAS_BNB_USD);
        nvda = market.list("NVIDIA bStock", "NVDAB", 150 ether);
        amd = market.list("AMD bStock", "AMDB", 120 ether);

        uint256 nonce = vm.getNonce(address(this));
        address predicted = vm.computeCreateAddress(address(this), nonce + 1);
        vaultFactory = new PackVaultFactory(predicted, address(market));
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
        b.style = 1;
    }

    function _config(bytes32 seed) internal returns (PackConfig memory c) {
        c.name = "Chip Rush";
        c.symbol = "CHIP";
        c.meta = "bafkreig4y5nwb4izyilbbmiydumvkld446d4k7j4ohg3x3q2lfel3fo4yq";
        c.salt = _mineSalt(seed);
        c.packPrice = PRICE;
        c.packsForSale = PACKS;
        c.saleDuration = 1 days;
        c.vaultFactory = address(vaultFactory);
        c.seedBps = 2000;
        c.basket = _basket();
    }

    function test_fullJourney_presaleLaunchTaxPacksCards() public {
        _deploy();
        _openLauncherFactory(address(launcherFactory));

        PackConfig memory c = _config("pack-journey");
        vm.recordLogs();
        PackLauncher launcher = PackLauncher(payable(_newLauncher(address(launcherFactory), abi.encode(c))));
        Vm.Log[] memory creation = vm.getRecordedLogs();
        assertEq(portal.getLauncher(address(launcher)).launcherFactory, address(launcherFactory), "recorded");
        _assertLauncherDescription(address(launcher), c.name, c.symbol, PRICE * PACKS, creation);

        // Presale: alice 4 packs, bob 6; bob's purchase sells out and launches.
        vm.prank(alice);
        launcher.buyPacks{value: 4 * PRICE}(4);
        assertFalse(launcher.launched());
        vm.prank(bob);
        launcher.buyPacks{value: 6 * PRICE}(6);
        assertTrue(launcher.launched(), "launched on sell-out");

        address token = launcher.token();
        (address vaultAddr, address vf) = portal.getLaunchVault(token);
        assertEq(vf, address(vaultFactory), "vault from the paired factory");
        assertEq(vaultAddr, launcher.vault());
        PackVault vault = PackVault(payable(vaultAddr));
        assertEq(vault.launcher(), address(launcher));
        assertEq(vault.creator(), creator);
        assertEq(vaultAddr.balance, PRICE * PACKS * 2000 / 10_000, "seed arrived");
        assertEq(address(launcher).balance, 0, "launcher keeps nothing");

        // Presale packs show up in the vault.
        assertEq(vault.packsOf(alice), 4);
        assertEq(vault.packsOf(bob), 6);

        // Token claims: half the supply by packs.
        vm.prank(alice);
        launcher.claim();
        vm.prank(bob);
        launcher.claim();
        uint256 reserved = launcher.TOTAL_SUPPLY() - launcher.POOL_TOKEN();
        assertEq(IERC20(token).balanceOf(alice), reserved * 4 / 10);
        assertEq(IERC20(token).balanceOf(bob), reserved * 6 / 10);

        // Trading tax reaches the vault in BNB.
        uint256 before_ = vaultAddr.balance;
        _generateTaxAndDispatch(token);
        assertGt(vaultAddr.balance, before_, "the VAULT slot paid the vault");

        // Open, reveal, redeem.
        vm.prank(alice);
        uint256 id = vault.open();
        vm.roll(block.number + 2);
        uint256 cardId = vault.reveal(id);
        assertEq(vault.ownerOf(cardId), alice);
        (address stock,,, uint256 amount) = vault.cards(cardId);
        assertGt(amount, 0);
        vm.prank(alice);
        vault.redeem(cardId);
        assertEq(MockBStock(stock).balanceOf(alice), amount, "alice holds the bStock");

        // Packs bought after launch go into the pool.
        uint256 pool = vaultAddr.balance;
        vm.prank(bob);
        vault.buy{value: 2 * PRICE}(2);
        assertEq(vaultAddr.balance, pool + 2 * PRICE);
        assertEq(vault.packsOf(bob), 8);
    }

    function test_refundWhenNotSoldOut() public {
        _deploy();
        _openLauncherFactory(address(launcherFactory));
        PackLauncher launcher =
            PackLauncher(payable(_newLauncher(address(launcherFactory), abi.encode(_config("pack-refund")))));
        vm.prank(alice);
        launcher.buyPacks{value: 3 * PRICE}(3);

        vm.prank(alice);
        vm.expectRevert(PackLauncher.RefundUnavailable.selector);
        launcher.refund();

        vm.warp(block.timestamp + 1 days);
        vm.prank(bob);
        vm.expectRevert(PackLauncher.SaleClosed.selector);
        launcher.buyPacks{value: PRICE}(1);

        uint256 bal = alice.balance;
        vm.prank(alice);
        launcher.refund();
        assertEq(alice.balance, bal + 3 * PRICE);
    }

    function test_factoryRejectsBadConfigs() public {
        _deploy();
        _openLauncherFactory(address(launcherFactory));
        uint256 fee = portal.SALT_LOCK_FEE();

        PackConfig memory c = _config("pack-bad-1");
        c.vaultFactory = address(0xdead);
        vm.prank(creator);
        vm.expectRevert(
            abi.encodeWithSelector(PackLauncherFactory.WrongVaultFactory.selector, address(0xdead), address(vaultFactory))
        );
        portal.newLauncher{value: fee}(address(launcherFactory), abi.encode(c));

        c = _config("pack-bad-2");
        c.basket.weights[0] = 5000; // sums to 9000
        vm.prank(creator);
        vm.expectRevert(PackVaultFactory.BadBasket.selector);
        portal.newLauncher{value: fee}(address(launcherFactory), abi.encode(c));

        c = _config("pack-bad-3");
        c.basket.stocks[1] = address(0xbeef); // not listed
        vm.prank(creator);
        vm.expectRevert(abi.encodeWithSelector(PackVaultFactory.StockNotListed.selector, address(0xbeef)));
        portal.newLauncher{value: fee}(address(launcherFactory), abi.encode(c));

        c = _config("pack-bad-4");
        c.seedBps = 6000;
        vm.prank(creator);
        vm.expectRevert(abi.encodeWithSelector(PackLauncherFactory.SeedBpsOutOfRange.selector, 6000));
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
        PackLauncher launcher =
            PackLauncher(payable(_newLauncher(address(launcherFactory), abi.encode(_config("pack-upgrade")))));
        vm.startPrank(alice);
        launcher.buyPacks{value: 4 * PRICE}(4);
        vm.stopPrank();
        vm.startPrank(bob);
        launcher.buyPacks{value: 6 * PRICE}(6);
        vm.stopPrank();
        PackVault vault = PackVault(payable(launcher.vault()));
        uint256 poolBefore = address(vault).balance;

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

        // State survives on both proxies.
        assertEq(launcher.packsOf(alice), 4);
        assertTrue(launcher.launched());
        assertEq(vault.packsOf(bob), 6);
        assertEq(vault.launcher(), address(launcher));
        assertEq(address(vault).balance, poolBefore);
    }

    function test_descriptionStaysUnderThePortalLimit() public {
        _deploy();
        _openLauncherFactory(address(launcherFactory));
        PackConfig memory c = _config("pack-long-name");
        c.name = "A coin name that is long on purpose, long enough to test the description size limit ok";
        c.symbol = "LONGSYMBOL";
        PackLauncher launcher = PackLauncher(payable(_newLauncher(address(launcherFactory), abi.encode(c))));
        assertLt(bytes(launcher.description()).length, 4096, "Portal reads at most 4 KB");
    }

    function test_vaultFactoryRefusesAStrangerLauncher() public {
        _deploy();
        _openVaultFactory(address(vaultFactory));

        IPortalTypes.FeeConfig[] memory fees = new IPortalTypes.FeeConfig[](2);
        fees[0] = IPortalTypes.FeeConfig({
            feeType: IPortalTypes.FeeSlotType.VAULT,
            bps: 8000,
            configData: abi.encode(
                IPortalTypes.FeeConfigVault({
                    vaultFactory: address(vaultFactory), vaultData: abi.encode(creator, _basket(), PRICE)
                })
            )
        });
        fees[1] = IPortalTypes.FeeConfig({feeType: IPortalTypes.FeeSlotType.DEFLATION, bps: 2000, configData: ""});

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
