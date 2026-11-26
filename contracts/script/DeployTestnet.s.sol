// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {VmSafe} from "forge-std/Vm.sol";
import {MainnetConfig} from "./MainnetConfig.sol";
import {TestnetConfig} from "./TestnetConfig.sol";

/// Deploys the Grailio suite on BSC testnet (TestnetConfig.deployAll): packs paid in Flap test USD with 9 tiers (all
/// on sale), cards holding the trade market's 15 test stocks, staking, market, points, DAO, chat (lounge + one room
/// per stock), names, profiles. A real broadcast writes ../deployments/97.json for the testnet app.
///
/// Env: STOCKS_JSON (default script/stocks.testnet.json), STAKING_BPS (default 5000).
///
/// Dry run (sends nothing):
///   forge script script/DeployTestnet.s.sol --rpc-url https://bsc-testnet-rpc.publicnode.com --sender <deployer>
/// Real deploy:
///   forge script script/DeployTestnet.s.sol --rpc-url https://bsc-testnet-rpc.publicnode.com \
///     --account grailio-deployer --broadcast --slow --legacy --with-gas-price 100000000
///
/// Medium and High sell only once the pool holds test USD: mint some to yourself on Flap's test USD and send it to
/// CollectPacks.
contract DeployTestnet is Script {
    function run() external returns (TestnetConfig.Deployment memory d) {
        string memory json = vm.readFile(vm.envOr("STOCKS_JSON", string(TestnetConfig.DEFAULT_PATH)));
        uint16 stakingBps = uint16(vm.envOr("STAKING_BPS", uint256(5000)));

        vm.startBroadcast();
        (, address deployer,) = vm.readCallers();
        d = TestnetConfig.deployAll(deployer, stakingBps, json);
        vm.stopBroadcast();

        console.log("CollectPacks:", address(d.packs));
        console.log("CollectMarket:", address(d.market));
        console.log("CollectPoints:", address(d.points));
        console.log("CollectDAO:", address(d.dao));
        console.log("CollectChat:", address(d.chat));
        console.log("CollectNames:", address(d.names));
        console.log("CollectProfiles:", address(d.profiles));
        console.log("CollectStaking:", address(d.staking));
        console.log("MarketV2Router:", address(d.router));
        console.log("owner:", d.packs.owner());
        for (uint256 i; i < d.stocks.length; ++i) {
            console.log(d.stocks[i].ticker, i, address(d.feeds[i]));
            require(d.packs.priceOf(i) > 0, string.concat(d.stocks[i].ticker, ": trade market price is stale or missing"));
        }

        if (vm.isContext(VmSafe.ForgeContext.ScriptBroadcast)) _write(d, json);
    }

    function _write(TestnetConfig.Deployment memory d, string memory json) internal {
        string memory path = "../deployments/97.json";
        string memory o = "deployment";
        vm.serializeUint(o, "chainId", 97);
        vm.serializeUint(o, "deployBlock", block.number);
        vm.serializeAddress(o, "payToken", vm.parseJsonAddress(json, ".payToken"));
        vm.serializeAddress(o, "tradeMarket", vm.parseJsonAddress(json, ".market"));
        vm.serializeAddress(o, "router", address(d.router));
        vm.serializeAddress(o, "collectPacks", address(d.packs));
        vm.serializeAddress(o, "collectMarket", address(d.market));
        vm.serializeAddress(o, "collectPoints", address(d.points));
        vm.serializeAddress(o, "collectDao", address(d.dao));
        vm.serializeAddress(o, "collectChat", address(d.chat));
        vm.serializeAddress(o, "collectNames", address(d.names));
        vm.serializeAddress(o, "collectProfiles", address(d.profiles));
        vm.serializeAddress(o, "collectStaking", address(d.staking));
        vm.serializeAddress(o, "owner", d.packs.owner());

        // stockAssets: ticker -> {assetId, token, feed}.
        string memory assetsJson;
        for (uint256 i; i < d.stocks.length; ++i) {
            string memory e = d.stocks[i].ticker;
            vm.serializeUint(e, "assetId", i);
            vm.serializeAddress(e, "token", d.stocks[i].token);
            assetsJson = vm.serializeString("stockAssets", e, vm.serializeAddress(e, "feed", address(d.feeds[i])));
        }
        vm.serializeString(o, "stockAssets", assetsJson);

        // baskets: edition -> tickers (tiers e*3 .. e*3+2 draw from it).
        string memory bj;
        for (uint256 e; e < MainnetConfig.EDITIONS; ++e) {
            string memory name = MainnetConfig.edition(e);
            bj = vm.serializeString("baskets", name, vm.parseJsonStringArray(json, string.concat(".baskets.", name)));
        }
        string memory out = vm.serializeString(o, "baskets", bj);
        vm.writeJson(out, path);
        console.log("wrote", path);
    }
}
