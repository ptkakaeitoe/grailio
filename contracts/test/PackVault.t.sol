// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {LibClone} from "solady/utils/LibClone.sol";
import {MockStockMarket} from "src/stocks/MockStockMarket.sol";
import {MockBStock} from "src/stocks/MockBStock.sol";
import {PackVault} from "src/packs/PackVault.sol";
import {PackBasket, PackOdds} from "src/packs/PackTypes.sol";

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

/// @dev Stands in for `PackLauncher`: the vault only reads these.
contract FakeLauncher {
    address public creator;
    mapping(address => uint256) public packsOf;

    constructor(address creator_) {
        creator = creator_;
    }

    function name() external pure returns (string memory) {
        return "Chip Rush";
    }

    function setPacks(address a, uint256 n) external {
        packsOf[a] = n;
    }
}

/// @notice The vault on its own (no Portal): packs, solvency, reveals, cards and redemption.
contract PackVaultTest is Test {
    MockStockMarket market;
    MockFeed feed;
    address nvda;
    address amd;
    FakeLauncher launcher;
    PackVault vault;

    address owner = makeAddr("owner");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    uint256 constant PRICE = 0.01 ether;

    function setUp() public {
        feed = new MockFeed();
        market = new MockStockMarket(owner, address(feed));
        vm.startPrank(owner);
        // At $500 per BNB: $125 = 0.25 BNB, $100 = 0.2 BNB.
        nvda = market.list("NVIDIA bStock", "NVDAB", 125 ether);
        amd = market.list("AMD bStock", "AMDB", 100 ether);
        vm.stopPrank();

        launcher = new FakeLauncher(makeAddr("creator"));
        vault = _newVault(1);
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
    }

    function _newVault(uint8 style) internal returns (PackVault v) {
        address[] memory stocks = new address[](2);
        stocks[0] = nvda;
        stocks[1] = amd;
        uint16[] memory weights = new uint16[](2);
        weights[0] = 6000;
        weights[1] = 4000;
        v = PackVault(payable(LibClone.deployERC1967(address(new PackVault()))));
        v.initialize(makeAddr("token"), address(launcher), PackBasket(address(market), stocks, weights, style), PRICE);
    }

    function _fund(uint256 amount) internal {
        vm.deal(address(this), amount);
        (bool ok,) = address(vault).call{value: amount}("");
        assertTrue(ok);
    }

    function _openAndReveal(address who) internal returns (uint256 cardId) {
        vm.prank(who);
        uint256 id = vault.open();
        vm.roll(block.number + 2);
        cardId = vault.reveal(id);
    }

    function test_oddsAverageNinetyPercent() public pure {
        for (uint8 s; s < PackOdds.STYLES; ++s) {
            uint16[10] memory t = PackOdds.table(s);
            uint256 sum;
            for (uint256 i; i < 10; ++i) {
                sum += t[i];
                if (i > 0) assertGe(t[i], t[i - 1], "sorted");
            }
            assertEq(sum, 90_000, "average 90%");
        }
    }

    function test_presalePacksCountAndOpen() public {
        launcher.setPacks(alice, 3);
        assertEq(vault.packsOf(alice), 3);
        _fund(1 ether);
        uint256 cardId = _openAndReveal(alice);
        assertEq(vault.packsOf(alice), 2);
        assertEq(vault.ownerOf(cardId), alice);
        assertEq(vault.pendingReserve(), 0);
    }

    function test_buyPaysThePool() public {
        vm.prank(alice);
        vault.buy{value: 3 * PRICE}(3);
        assertEq(vault.packsOf(alice), 3);
        assertEq(address(vault).balance, 3 * PRICE);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(PackVault.WrongPayment.selector, PRICE, 2 * PRICE));
        vault.buy{value: PRICE}(2);
    }

    function test_openNeedsThePoolToCoverTheTopPrize() public {
        launcher.setPacks(alice, 2);
        uint256 top = vault.maxPayout();
        assertEq(top, PRICE * 15_000 / 10_000);
        _fund(top - 1);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(PackVault.PoolTooSmall.selector, top - 1, top));
        vault.open();

        _fund(1);
        vm.prank(alice);
        vault.open();
        // The first reveal in flight holds the whole pool, so a second pack must wait.
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(PackVault.PoolTooSmall.selector, 0, top));
        vault.open();
    }

    function test_noPacksNoOpen() public {
        _fund(1 ether);
        vm.prank(bob);
        vm.expectRevert(PackVault.NoPacks.selector);
        vault.open();
    }

    function test_revealWaitsForTheNextBlock() public {
        launcher.setPacks(alice, 1);
        _fund(1 ether);
        vm.prank(alice);
        uint256 id = vault.open();
        vm.expectRevert(abi.encodeWithSelector(PackVault.RevealNotReady.selector, id));
        vault.reveal(id);
        vm.roll(block.number + 1);
        vm.expectRevert(abi.encodeWithSelector(PackVault.RevealNotReady.selector, id));
        vault.reveal(id);
        vm.roll(block.number + 1);
        vault.reveal(id);
        vm.expectRevert(abi.encodeWithSelector(PackVault.AlreadyRevealed.selector, id));
        vault.reveal(id);
    }

    function test_cardHoldsTheStockItPaidFor() public {
        launcher.setPacks(alice, 1);
        _fund(1 ether);
        uint256 cardId = _openAndReveal(alice);
        (address stock, uint16 bps, uint256 value, uint256 amount) = vault.cards(cardId);
        assertTrue(stock == nvda || stock == amd);
        assertEq(value, PRICE * bps / 10_000);
        assertEq(amount, value * 1e18 / market.priceWei(stock));
        assertEq(MockBStock(stock).balanceOf(address(vault)), amount);
        assertEq(address(vault).balance, 1 ether - value);
    }

    function test_lateRevealPaysTheLowestPrize() public {
        launcher.setPacks(alice, 1);
        _fund(1 ether);
        vm.prank(alice);
        uint256 id = vault.open();
        vm.roll(block.number + 300);
        uint256 cardId = vault.reveal(id);
        (, uint16 bps,,) = vault.cards(cardId);
        assertEq(bps, PackOdds.minBps(1));
    }

    function test_redeemBurnsAndPaysTheStock() public {
        launcher.setPacks(alice, 1);
        _fund(1 ether);
        uint256 cardId = _openAndReveal(alice);
        (address stock,,, uint256 amount) = vault.cards(cardId);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(PackVault.NotYourCard.selector, cardId));
        vault.redeem(cardId);

        vm.prank(alice);
        vault.redeem(cardId);
        assertEq(MockBStock(stock).balanceOf(alice), amount);
        assertEq(MockBStock(stock).balanceOf(address(vault)), 0);
        vm.expectRevert();
        vault.ownerOf(cardId);
    }

    function test_cardsAreTransferable() public {
        launcher.setPacks(alice, 1);
        _fund(1 ether);
        uint256 cardId = _openAndReveal(alice);
        vm.prank(alice);
        vault.transferFrom(alice, bob, cardId);
        vm.prank(bob);
        vault.redeem(cardId);
    }

    function test_manyPacksStaySolventAndAverageNearNinety() public {
        launcher.setPacks(alice, 200);
        _fund(10 ether);
        uint256 paid;
        for (uint256 i; i < 200; ++i) {
            vm.prank(alice);
            uint256 id = vault.open();
            vm.roll(block.number + 2);
            (,, uint256 value,) = vault.cards(vault.reveal(id));
            paid += value;
        }
        assertEq(address(vault).balance, 10 ether - paid);
        uint256 avgBps = paid * 10_000 / (200 * PRICE);
        assertGt(avgBps, 7500);
        assertLt(avgBps, 10_500);
    }

    function test_marketPricesFollowAtlasBnbUsd() public {
        assertEq(market.bnbUsd(), 500 ether);
        assertEq(market.priceWei(nvda), 0.25 ether);
        feed.set(1000e8); // BNB doubles: the stock costs half as much BNB
        assertEq(market.priceWei(nvda), 0.125 ether);

        address[] memory s = new address[](1);
        s[0] = nvda;
        uint256[] memory p = new uint256[](1);
        p[0] = 250 ether;
        vm.prank(owner);
        market.setUsdPrices(s, p);
        assertEq(market.priceWei(nvda), 0.25 ether);

        vm.prank(alice);
        vm.expectRevert();
        market.setUsdPrices(s, p);

        feed.set(0);
        vm.expectRevert(MockStockMarket.BadFeed.selector);
        market.priceWei(nvda);
    }

    function test_tokenURIAndName() public {
        launcher.setPacks(alice, 1);
        _fund(1 ether);
        uint256 cardId = _openAndReveal(alice);
        assertEq(vault.name(), "Chip Rush Cards");
        assertGt(bytes(vault.tokenURI(cardId)).length, 50);
        assertGt(bytes(vault.description()).length, 50);
    }

    function test_marketSellsBack() public {
        vm.prank(alice);
        uint256 amount = market.buy{value: 1 ether}(nvda, alice);
        assertEq(amount, 4 ether);
        vm.prank(alice);
        uint256 paid = market.sell(nvda, amount, alice);
        assertEq(paid, 1 ether);
        assertEq(MockBStock(nvda).totalSupply(), 0);

        vm.expectRevert(MockBStock.OnlyMarket.selector);
        MockBStock(nvda).mint(alice, 1);
    }
}
