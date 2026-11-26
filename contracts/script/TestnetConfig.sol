// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Vm} from "forge-std/Vm.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {CollectPacks, IAggregatorV3, ICollectPoints, ISwapRouter02, IV2Router} from "../src/CollectPacks.sol";
import {CollectPoints} from "../src/CollectPoints.sol";
import {CollectDAO, IPoints} from "../src/CollectDAO.sol";
import {CollectMarket} from "../src/CollectMarket.sol";
import {CollectChat} from "../src/CollectChat.sol";
import {CollectNames} from "../src/CollectNames.sol";
import {CollectProfiles, IStakes} from "../src/CollectProfiles.sol";
import {CollectStaking, ICollectCards} from "../src/CollectStaking.sol";
import {MarketV2Router, ITestStockMarket} from "../src/testnet/MarketV2Router.sol";
import {MarketPriceFeed} from "../src/testnet/MarketPriceFeed.sol";
import {MainnetConfig} from "./MainnetConfig.sol";

/// The same Grailio suite as MainnetConfig.deployAll, for BSC testnet (chain 97):
/// - pays in Flap's free-mint test USD instead of USDT (18 decimals, so the tiers are unchanged);
/// - cards hold the testnet trade market's test stocks (script/stocks.testnet.json, same order and baskets as
///   mainnet), bought through MarketV2Router and priced by one MarketPriceFeed per stock;
/// - every tier is on sale from the start (Medium/High still need a pool to sell).
/// maxFeedAge is 7 days: testnet prices are only refreshed when someone trades.
library TestnetConfig {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    string internal constant DEFAULT_PATH = "script/stocks.testnet.json";
    uint32 internal constant MAX_FEED_AGE = 7 days;
    uint16 internal constant MAX_SLIPPAGE_BPS = 300;

    struct Stock {
        string ticker;
        address token;
    }

    struct Deployment {
        CollectPacks packs;
        CollectMarket market;
        CollectPoints points;
        CollectDAO dao;
        CollectStaking staking;
        CollectChat chat;
        CollectNames names;
        CollectProfiles profiles;
        MarketV2Router router;
        MarketPriceFeed[] feeds; // per stock, index = asset ID
        uint8[][] baskets; // per edition
        Stock[] stocks;
    }

    function load(string memory json) internal view returns (Stock[] memory stocks) {
        uint256 n;
        while (vm.keyExistsJson(json, string.concat(".stocks[", vm.toString(n), "]"))) ++n;
        require(n > 0, "no stocks in testnet config");
        stocks = new Stock[](n);
        for (uint256 i; i < n; ++i) {
            string memory k = string.concat(".stocks[", vm.toString(i), "]");
            stocks[i] = Stock(vm.parseJsonString(json, string.concat(k, ".ticker")), vm.parseJsonAddress(json, string.concat(k, ".token")));
        }
    }

    function basket(string memory json, string memory edition, Stock[] memory stocks) internal view returns (uint8[] memory ids) {
        string[] memory tickers = vm.parseJsonStringArray(json, string.concat(".baskets.", edition));
        ids = new uint8[](tickers.length);
        for (uint256 t; t < tickers.length; ++t) {
            bool found;
            for (uint256 i; i < stocks.length; ++i) {
                if (keccak256(bytes(stocks[i].ticker)) == keccak256(bytes(tickers[t]))) {
                    ids[t] = uint8(i);
                    found = true;
                    break;
                }
            }
            require(found, string.concat("basket ticker not in stocks: ", tickers[t]));
        }
    }

    /// Everything, in mainnet's order. Every call must come from `deployer` (vm.startBroadcast or vm.startPrank).
    function deployAll(address deployer, uint16 stakingBps, string memory json) internal returns (Deployment memory d) {
        IERC20 payToken = IERC20(vm.parseJsonAddress(json, ".payToken"));
        ITestStockMarket stockMarket = ITestStockMarket(vm.parseJsonAddress(json, ".market"));
        require(IERC20Metadata(address(payToken)).decimals() == 18, "tier amounts assume an 18-decimal pay token");
        d.stocks = load(json);

        d.router = new MarketV2Router(stockMarket);
        d.packs = new CollectPacks(payToken, ISwapRouter02(address(0)), IV2Router(address(d.router)), deployer);
        MainnetConfig.addTiers(d.packs);

        d.feeds = new MarketPriceFeed[](d.stocks.length);
        address[] memory path = new address[](2);
        path[0] = address(payToken);
        for (uint256 i; i < d.stocks.length; ++i) {
            d.feeds[i] = new MarketPriceFeed(stockMarket, d.stocks[i].token, string.concat(d.stocks[i].ticker, " / USD (testnet market)"));
            path[1] = d.stocks[i].token;
            uint256 id = d.packs.addAsset(
                IERC20Metadata(d.stocks[i].token),
                IAggregatorV3(address(d.feeds[i])),
                MAX_FEED_AGE,
                MAX_SLIPPAGE_BPS,
                CollectPacks.Route.V2,
                "",
                path
            );
            require(id == i, "asset ID must equal the stock's index");
        }
        d.baskets = new uint8[][](MainnetConfig.EDITIONS);
        for (uint256 e; e < MainnetConfig.EDITIONS; ++e) {
            d.baskets[e] = basket(json, MainnetConfig.edition(e), d.stocks);
            for (uint256 t; t < 3; ++t) d.packs.setTierAssets(e * 3 + t, d.baskets[e]);
        }

        d.market = new CollectMarket(payToken, address(d.packs), deployer);
        d.market.setListable(address(d.packs), true);
        d.market.setTreasury(address(d.packs), true);
        d.points = new CollectPoints(deployer);
        d.points.setAwarder(address(d.packs), true);
        d.packs.setPoints(ICollectPoints(address(d.points)), 1);
        d.dao = new CollectDAO(IPoints(address(d.points)), deployer);
        d.staking = new CollectStaking(ICollectCards(address(d.packs)), payToken);
        d.packs.setShares(address(d.staking), stakingBps, address(0), 0);

        d.chat = new CollectChat(deployer);
        d.chat.addRoom("The lounge", CollectChat.Gate.Open, address(0), 0, 0, false);
        for (uint256 i; i < d.stocks.length; ++i) {
            d.chat.addRoom(d.stocks[i].ticker, CollectChat.Gate.Card, address(d.staking), i, 1, true);
        }
        d.names = new CollectNames();
        d.profiles = new CollectProfiles(IERC721(address(d.packs)), IStakes(address(d.staking)));
    }
}
