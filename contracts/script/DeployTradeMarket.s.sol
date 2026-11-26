// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {MockStockMarket} from "src/stocks/MockStockMarket.sol";

/// @notice Deploys the trade market for the app's Trade tab on BSC testnet: a fresh MockStockMarket (separate from the
///         pack vaults' market), the 15 stocks in `script/trade-stocks.json` at their Atlas prices, Flap's testnet USD
///         as a $1 quote the market may mint to pay sellers, and the price keeper. Writes the addresses to
///         deployments/97.json ("tradeMarket", "tradeStocks").
///
///   KEEPER=0x… forge script script/DeployTradeMarket.s.sol --rpc-url https://bsc-testnet-rpc.publicnode.com \
///     --account <testnet deployer> --broadcast --legacy --with-gas-price 100000000
contract DeployTradeMarket is Script {
    address internal constant ATLAS_BNB_USD = 0x3957d289ee9C38272377786787ea34F9dd29788D;
    address internal constant FLAP_TEST_USD = 0x190C989D5665a0e404B444b53CAE9AbCfb600157;

    function run() external {
        address keeper = vm.envOr("KEEPER", address(0));
        string memory json = vm.readFile(string.concat(vm.projectRoot(), "/script/trade-stocks.json"));
        string[] memory tickers = vm.parseJsonStringArray(json, ".tickers");
        string[] memory names = vm.parseJsonStringArray(json, ".names");
        string[] memory symbols = vm.parseJsonStringArray(json, ".symbols");
        string[] memory prices = vm.parseJsonStringArray(json, ".usd");
        require(
            tickers.length == names.length && names.length == symbols.length && symbols.length == prices.length,
            "trade-stocks.json lengths differ"
        );

        vm.startBroadcast();
        (, address deployer,) = vm.readCallers();
        MockStockMarket market = new MockStockMarket(deployer, ATLAS_BNB_USD);
        market.setQuote(FLAP_TEST_USD, 1e18);
        market.setMintableQuote(FLAP_TEST_USD, true);
        if (keeper != address(0)) market.setKeeper(keeper);
        string memory stocksJson = "tradeStocks";
        string memory out;
        for (uint256 i; i < tickers.length; ++i) {
            address stock = market.list(names[i], symbols[i], vm.parseUint(prices[i]));
            out = vm.serializeAddress(stocksJson, tickers[i], stock);
            console2.log(tickers[i], stock);
        }
        vm.stopBroadcast();

        console2.log("tradeMarket", address(market));
        console2.log("keeper", keeper);
        string memory path = string.concat(vm.projectRoot(), "/deployments/97.json");
        vm.writeJson(vm.toString(address(market)), path, ".tradeMarket");
        vm.writeJson(out, path, ".tradeStocks");
    }
}
