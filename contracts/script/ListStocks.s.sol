// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {MockStockMarket} from "src/stocks/MockStockMarket.sol";

/// @notice Lists the mock bStocks in `script/stocks.json` on the market at their Atlas USD prices (18 decimals). The
///         market converts to BNB with Atlas's on-chain BNB/USD feed.
///
///   MARKET=0x… forge script script/ListStocks.s.sol --rpc-url <rpc> --account deployer --broadcast --legacy \
///     --with-gas-price 100000000
contract ListStocks is Script {
    function run() external {
        MockStockMarket market = MockStockMarket(payable(vm.envAddress("MARKET")));
        string memory json = vm.readFile(string.concat(vm.projectRoot(), "/script/stocks.json"));
        string[] memory names = vm.parseJsonStringArray(json, ".names");
        string[] memory symbols = vm.parseJsonStringArray(json, ".symbols");
        string[] memory prices = vm.parseJsonStringArray(json, ".usd");
        require(names.length == symbols.length && symbols.length == prices.length, "stocks.json lengths differ");

        vm.startBroadcast();
        for (uint256 i; i < symbols.length; ++i) {
            address stock = market.list(names[i], symbols[i], vm.parseUint(prices[i]));
            console2.log(symbols[i], stock);
        }
        vm.stopBroadcast();
    }
}
