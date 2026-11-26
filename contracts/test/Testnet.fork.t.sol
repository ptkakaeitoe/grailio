// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {CollectPacks} from "../src/CollectPacks.sol";
import {CollectChat} from "../src/CollectChat.sol";
import {TestnetConfig} from "../script/TestnetConfig.sol";

interface IMintable {
    function mint(address to, uint256 amount) external;
}

/// The whole testnet deploy (TestnetConfig.deployAll, as DeployTestnet runs it) on a BSC testnet fork: Flap's test
/// USD, the real trade market and its test stocks. Nothing is broadcast. Run with:
///   BSC_TESTNET_RPC_URL=https://bsc-testnet-rpc.publicnode.com forge test --match-contract TestnetFork -vv
contract TestnetForkTest is Test {
    address constant DEPLOYER = 0x2893bE18282db59477FA1C7A4ebc94C4d73F001b;

    TestnetConfig.Deployment d;
    CollectPacks packs;
    IERC20 usd;
    address player = makeAddr("player");
    address buyer = makeAddr("buyer");

    function setUp() public {
        string memory rpc = vm.envOr("BSC_TESTNET_RPC_URL", string(""));
        if (bytes(rpc).length == 0) {
            vm.skip(true);
            return;
        }
        vm.createSelectFork(rpc);
        string memory json = vm.readFile(TestnetConfig.DEFAULT_PATH);
        vm.startPrank(DEPLOYER, DEPLOYER);
        d = TestnetConfig.deployAll(DEPLOYER, 5000, json);
        vm.stopPrank();
        packs = d.packs;
        usd = IERC20(vm.parseJsonAddress(json, ".payToken"));

        // Anyone can mint Flap's test USD (the app's "Claim test USD").
        IMintable(address(usd)).mint(player, 1_000e18);
        IMintable(address(usd)).mint(buyer, 100e18);
        vm.prank(player);
        usd.approve(address(packs), type(uint256).max);
    }

    function test_deployMatchesMainnetShape() public view {
        assertEq(packs.owner(), DEPLOYER);
        assertEq(address(packs.usdc()), address(usd));
        assertEq(packs.assetCount(), 15);
        assertEq(packs.tierCount(), 9);
        for (uint256 t; t < 9; ++t) assertTrue(packs.tier(t).active, "every tier on sale");
        for (uint256 e; e < 3; ++e) {
            assertEq(packs.tierAssetMask(e * 3), uint256(0x1f) << (5 * e));
        }
        for (uint256 i; i < 15; ++i) {
            assertEq(address(packs.asset(i).token), d.stocks[i].token);
            assertGt(packs.priceOf(i), 0, "trade market price missing or stale");
        }
        CollectChat.Room[] memory rooms = d.chat.rooms();
        assertEq(rooms.length, 16);
        assertEq(rooms[0].name, "The lounge");
        assertEq(rooms[1].name, "NVDA");
        assertEq(rooms[15].gate, address(d.staking));
        assertEq(packs.stakingSink(), address(d.staking));
    }

    /// Fable Low: the card fills through MarketV2Router with a Fable stock, and redeeming hands it over.
    function test_fableLowFillsAndRedeems() public {
        uint256 cardId = _buyAndOpen(0, "fable");
        (uint8 a,,, bool filled, uint128 cardUsd, uint256 amount) = packs.cards(cardId);
        assertEq(cardUsd, 0.95e18);
        assertTrue(filled, "card should fill via the trade market");
        assertLt(a, 5, "Fable basket is assets 0-4");
        assertEq(amount, packs.fairAmount(a, cardUsd), "router buys exactly at the feed price");
        console.log(d.stocks[a].ticker, amount);

        IERC20 stock = IERC20(d.stocks[a].token);
        vm.prank(player);
        packs.redeem(cardId);
        assertEq(stock.balanceOf(player), amount);
    }

    /// Medium sells once the pool holds test USD, and its card fills too.
    function test_mediumWithSeededPool() public {
        assertEq(packs.capacity(1), 0, "empty pool: no Medium yet");
        IMintable(address(usd)).mint(address(packs), 50e18);
        assertGt(packs.capacity(1), 0);
        uint256 cardId = _buyAndOpen(1, "medium");
        (,,, bool filled,,) = packs.cards(cardId);
        assertTrue(filled);
    }

    /// Low-pack margin is revenue; distribute() pays the staking share and a staked card earns it.
    function test_stakeAndClaim() public {
        uint256 cardId = _buyAndOpen(0, "stake");
        for (uint256 i; i < 4; ++i) _buyAndOpen(3, string.concat("rev", vm.toString(i))); // more margin
        vm.startPrank(player);
        IERC721(address(packs)).setApprovalForAll(address(d.staking), true);
        uint256[] memory ids = new uint256[](1);
        ids[0] = cardId;
        d.staking.stake(ids);
        vm.stopPrank();

        uint256 sent = packs.distribute();
        assertGt(sent, 0, "margin to share");
        d.staking.sync(); // staking counts revenue it received at its next sync, then pays it out over time
        vm.warp(block.timestamp + 7 days);
        uint256 before = usd.balanceOf(player);
        vm.prank(player);
        d.staking.claim(ids);
        assertGt(usd.balanceOf(player), before, "staker earned test USD");
    }

    /// A card listed for test USD sells on CollectMarket.
    function test_marketSellsCardForUsd() public {
        uint256 cardId = _buyAndOpen(0, "market");
        vm.startPrank(player);
        IERC721(address(packs)).setApprovalForAll(address(d.market), true);
        d.market.list(address(packs), cardId, 2e18, false, uint64(block.timestamp + 1 days));
        vm.stopPrank();

        vm.startPrank(buyer);
        usd.approve(address(d.market), type(uint256).max);
        d.market.buy(address(packs), cardId, false, 2e18);
        vm.stopPrank();
        assertEq(IERC721(address(packs)).ownerOf(cardId), buyer);
    }

    function _buyAndOpen(uint256 tierId, string memory salt) internal returns (uint256 cardId) {
        vm.prank(player);
        uint256 packId = packs.buy(tierId, 1);
        (, uint64 revealBlock,,,) = packs.packs(packId);
        vm.roll(revealBlock + 1);
        vm.setBlockhash(revealBlock, keccak256(abi.encode("testnet", tierId, salt)));
        vm.prank(player);
        cardId = packs.open(packId);
    }
}
