// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {CollectPacks, IAggregatorV3, ISwapRouter02, IV2Router} from "../src/CollectPacks.sol";

/// Avalanche C-Chain addresses, all checked on-chain on 2026-11-22
/// (feed descriptions, router factories, pool existence).
library MainnetConfig {
    // Tokens
    address internal constant USDC = 0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E; // native USDC, 6 dec
    address internal constant WAVAX = 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7;
    address internal constant BTCB = 0x152b9d0FdC40C096757F570A51E494bd4b943E50; // 8 dec
    address internal constant WETHE = 0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB;
    address internal constant LINKE = 0x5947BB275c521040051D82396192181b413227A3;
    address internal constant JOE = 0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd;

    // Chainlink USD feeds (8 dec)
    address internal constant FEED_BTC = 0x2779D32d5166BAaa2B2b658333bA7e6Ec0C65743;
    address internal constant FEED_ETH = 0x976B3D034E162d8bD72D6b9C989d545b839003b0;
    address internal constant FEED_AVAX = 0x0A77230d17318075983913bC2145DB16C7366156;
    address internal constant FEED_LINK = 0x49ccd9ca821EfEab2b98c60dC60F518E765EDe9a;
    address internal constant FEED_JOE = 0x02D35d3a8aC3e1626d3eE09A78Dd87286F5E8e3a;

    // Routers
    address internal constant UNI_V3_ROUTER02 = 0xbb00FF08d01D300023C629E8fFfFcb65A5a578cE;
    address internal constant LFJ_V1_ROUTER = 0x60aE616a2155Ee3d9A68541Ba4544862310933d4;

    /// Tier order matches PACK_TIERS in the app: 0 Ember, 1 Flare, 2 Nova.
    function addTiers(CollectPacks packs) internal {
        // Ember: every card holds $0.95 of a random token (5% edge). Rarity no longer changes the value; it sets the staking multiplier.
        packs.addTier(1e6, [uint16(5000), 2500, 2000, 500], [uint64(0.95e6), 0.95e6, 0.95e6, 0.95e6]);
        packs.addTier(1e6, [uint16(5000), 2500, 2000, 500], [uint64(0.46e6), 0.8e6, 1.4e6, 4e6]);
        packs.addTier(1e6, [uint16(6000), 2500, 1200, 300], [uint64(0.2e6), 0.6e6, 2.8e6, 10.13e6]);
    }

    /// Asset order matches the app's cards: BTC, ETH, WAVAX, LINK, JOE.
    /// Feed age limits sit above each feed's heartbeat; slippage is vs Chainlink.
    function addAssets(CollectPacks packs) internal {
        address[] memory none;
        packs.addAsset(
            IERC20Metadata(BTCB),
            IAggregatorV3(FEED_BTC),
            1 days,
            150,
            CollectPacks.Route.UniswapV3,
            abi.encodePacked(USDC, uint24(500), BTCB),
            none
        );
        packs.addAsset(
            IERC20Metadata(WETHE),
            IAggregatorV3(FEED_ETH),
            1 days,
            200,
            CollectPacks.Route.UniswapV3,
            abi.encodePacked(USDC, uint24(500), WAVAX, uint24(500), WETHE),
            none
        );
        packs.addAsset(
            IERC20Metadata(WAVAX),
            IAggregatorV3(FEED_AVAX),
            1 days,
            150,
            CollectPacks.Route.UniswapV3,
            abi.encodePacked(USDC, uint24(500), WAVAX),
            none
        );
        packs.addAsset(
            IERC20Metadata(LINKE),
            IAggregatorV3(FEED_LINK),
            1 days,
            400,
            CollectPacks.Route.UniswapV3,
            abi.encodePacked(USDC, uint24(500), WAVAX, uint24(10000), LINKE),
            none
        );
        address[] memory joePath = new address[](3);
        joePath[0] = USDC;
        joePath[1] = WAVAX;
        joePath[2] = JOE;
        // JOE's DEX price has run ~4% over Chainlink; a tighter guard would refuse most fills.
        packs.addAsset(IERC20Metadata(JOE), IAggregatorV3(FEED_JOE), 1 days, 700, CollectPacks.Route.V2, "", joePath);
    }

    function deploy(address owner) internal returns (CollectPacks) {
        return new CollectPacks(IERC20(USDC), ISwapRouter02(UNI_V3_ROUTER02), IV2Router(LFJ_V1_ROUTER), owner);
    }
}
