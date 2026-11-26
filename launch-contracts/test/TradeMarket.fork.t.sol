// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/token/ERC20/IERC20.sol";
import {MockStockMarket, IMintable} from "src/stocks/MockStockMarket.sol";
import {MockBStock} from "src/stocks/MockBStock.sol";

/// The trade market on a BSC testnet fork: real Atlas BNB/USD feed and Flap's free-mint testnet USD. Buy with USD,
/// sell back for USD (minted by the market), buy with BNB, and the keeper posting prices. Run with:
///   BSC_TESTNET_RPC_URL=https://bsc-testnet-rpc.publicnode.com forge test --match-contract TradeMarketFork -vv
contract TradeMarketForkTest is Test {
    address constant ATLAS_BNB_USD = 0x3957d289ee9C38272377786787ea34F9dd29788D;
    address constant USD = 0x190C989D5665a0e404B444b53CAE9AbCfb600157;

    MockStockMarket market;
    address nvda;
    address owner = makeAddr("owner");
    address keeper = makeAddr("keeper");
    address alice = makeAddr("alice");

    function setUp() public {
        string memory rpc = vm.envOr("BSC_TESTNET_RPC_URL", string(""));
        if (bytes(rpc).length == 0) {
            vm.skip(true);
            return;
        }
        vm.createSelectFork(rpc);
        market = new MockStockMarket(owner, ATLAS_BNB_USD);
        vm.startPrank(owner);
        nvda = market.list("NVIDIA bStock (mock)", "NVDAB", 150e18);
        market.setQuote(USD, 1e18);
        market.setMintableQuote(USD, true);
        market.setKeeper(keeper);
        vm.stopPrank();
        // Anyone can mint Flap's testnet USD: the app's "Claim test USD".
        vm.prank(alice);
        IMintable(USD).mint(alice, 300e18);
    }

    function test_buyWithUsdThenSellForUsd() public {
        vm.startPrank(alice);
        IERC20(USD).approve(address(market), type(uint256).max);
        uint256 got = market.buyWith(nvda, USD, 150e18, alice);
        assertEq(got, 1e18, "150 USD buys 1 NVDA at $150");
        assertEq(IERC20(nvda).balanceOf(alice), 1e18);
        assertEq(IERC20(USD).balanceOf(alice), 150e18);

        uint256 paid = market.sellFor(nvda, USD, 0.5e18, alice);
        assertEq(paid, 75e18, "half an NVDA sells for 75 USD");
        assertEq(IERC20(nvda).balanceOf(alice), 0.5e18);
        assertEq(IERC20(USD).balanceOf(alice), 225e18, "sell paid by minting USD");
        vm.stopPrank();
    }

    function test_buyWithBnb() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        uint256 got = market.buy{value: 0.1 ether}(nvda, alice);
        uint256 bnbUsd = market.bnbUsd();
        assertGt(bnbUsd, 50e18, "Atlas BNB/USD looks live");
        assertApproxEqRel(got, 0.1 ether * bnbUsd / 150e18, 1e12);
    }

    function test_keeperPostsPricesOnly() public {
        address[] memory s = new address[](1);
        s[0] = nvda;
        uint256[] memory p = new uint256[](1);
        p[0] = 160e18;
        vm.warp(block.timestamp + 100);
        vm.prank(keeper);
        market.setUsdPrices(s, p);
        assertEq(market.usdPrice(nvda), 160e18);
        assertEq(market.priceAt(nvda), block.timestamp);

        vm.prank(alice);
        vm.expectRevert(MockStockMarket.NotPriceSetter.selector);
        market.setUsdPrices(s, p);

        // The keeper can't do owner things.
        vm.prank(keeper);
        vm.expectRevert();
        market.setKeeper(alice);
    }

    function test_sellForUnmintableQuoteReverts() public {
        address other = makeAddr("otherToken");
        vm.prank(owner);
        market.setQuote(other, 1e18);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(MockStockMarket.NotQuote.selector, other));
        market.sellFor(nvda, other, 1, alice);
    }
}
