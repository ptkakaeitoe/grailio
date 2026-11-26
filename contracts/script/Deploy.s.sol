// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {LaunchVaultAddresses} from "src/flap/LaunchVaultAddresses.sol";
import {MockStockMarket} from "src/stocks/MockStockMarket.sol";
import {PackLauncherFactory} from "src/packs/PackLauncherFactory.sol";
import {PackVaultFactory} from "src/packs/PackVaultFactory.sol";

/// @notice Deploys the stock market and the pack Launcher + Vault factory pair on BNB Testnet.
///
///   forge script script/Deploy.s.sol --rpc-url $BSC_TESTNET_RPC_URL --account deployer --broadcast --legacy \
///     --with-gas-price 100000000
///
/// The deployer owns the mock market (it lists stocks and posts their USD prices from Atlas; BNB/USD is read live from
/// Atlas's on-chain feed). The factories have no owner; only the Flap
/// Guardian can upgrade their beacons. After deploying, ask Flap to enable the PackLauncherFactory.
contract Deploy is Script {
    /// @notice Atlas's on-chain BNB/USD feed on BNB Testnet ("SingleFeed BNB/USD", 18 decimals).
    address internal constant ATLAS_BNB_USD = 0x3957d289ee9C38272377786787ea34F9dd29788D;

    function run() external {
        require(block.chainid == 97, "BNB Testnet only");
        address hub = LaunchVaultAddresses.hub();
        address guardian = LaunchVaultAddresses.guardian();

        vm.startBroadcast();
        address deployer = msg.sender;
        MockStockMarket market = new MockStockMarket(deployer, ATLAS_BNB_USD);

        // The vault factory needs the launcher factory's address and vice versa: predict the second deployment.
        uint256 nonce = vm.getNonce(deployer);
        address predicted = vm.computeCreateAddress(deployer, nonce + 1);
        PackVaultFactory vaultFactory = new PackVaultFactory(predicted, address(market));
        PackLauncherFactory launcherFactory = new PackLauncherFactory(hub, guardian, address(vaultFactory));
        require(address(launcherFactory) == predicted, "launcher factory address prediction failed");

        // List the mock bStocks at their Atlas USD prices (script/stocks.json).
        string memory json = vm.readFile(string.concat(vm.projectRoot(), "/script/stocks.json"));
        string[] memory names = vm.parseJsonStringArray(json, ".names");
        string[] memory symbols = vm.parseJsonStringArray(json, ".symbols");
        string[] memory usd = vm.parseJsonStringArray(json, ".usd");
        address[] memory listed = new address[](symbols.length);
        for (uint256 i; i < symbols.length; ++i) {
            listed[i] = market.list(names[i], symbols[i], vm.parseUint(usd[i]));
        }
        vm.stopBroadcast();

        for (uint256 i; i < symbols.length; ++i) {
            console2.log(symbols[i], listed[i]);
        }

        console2.log("MockStockMarket     ", address(market));
        console2.log("PackVaultFactory    ", address(vaultFactory));
        console2.log("PackLauncherFactory ", address(launcherFactory));
    }
}
