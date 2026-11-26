// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {LaunchVaultAddresses} from "src/flap/LaunchVaultAddresses.sol";
import {MockStockMarket} from "src/stocks/MockStockMarket.sol";
import {PackLauncherFactory} from "src/packs/PackLauncherFactory.sol";
import {PackVaultFactory} from "src/packs/PackVaultFactory.sol";

/// @notice Deploys the stock market and the pack Launcher + Vault factory pair on BNB Testnet.
///
///   forge script script/Deploy.s.sol --rpc-url $BSC_TESTNET_RPC_URL --account deployer --broadcast
///
/// The deployer owns the mock market (it lists stocks and posts prices). The factories have no owner; only the Flap
/// Guardian can upgrade their beacons. After deploying, ask Flap to enable the PackLauncherFactory.
contract Deploy is Script {
    function run() external {
        require(block.chainid == 97, "BNB Testnet only");
        address hub = LaunchVaultAddresses.hub();
        address guardian = LaunchVaultAddresses.guardian();

        vm.startBroadcast();
        address deployer = msg.sender;
        MockStockMarket market = new MockStockMarket(deployer);

        // The vault factory needs the launcher factory's address and vice versa: predict the second deployment.
        uint256 nonce = vm.getNonce(deployer);
        address predicted = vm.computeCreateAddress(deployer, nonce + 1);
        PackVaultFactory vaultFactory = new PackVaultFactory(predicted, address(market));
        PackLauncherFactory launcherFactory = new PackLauncherFactory(hub, guardian, address(vaultFactory));
        require(address(launcherFactory) == predicted, "launcher factory address prediction failed");
        vm.stopBroadcast();

        console2.log("MockStockMarket     ", address(market));
        console2.log("PackVaultFactory    ", address(vaultFactory));
        console2.log("PackLauncherFactory ", address(launcherFactory));
    }
}
