// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {LaunchVaultAddresses} from "src/flap/LaunchVaultAddresses.sol";
import {PackLauncherFactory} from "src/packs/PackLauncherFactory.sol";
import {PackVaultFactory} from "src/packs/PackVaultFactory.sol";

/// @notice Redeploys only the pack Launcher + Vault factory pair (current source: 50/50 supply split) on BNB Testnet,
///         wired to the existing trade market (keeper-refreshed Atlas prices, 15 stocks, Flap test USD at $1).
///         These are the two addresses to send Flap for enabling.
///
///   forge script script/DeployFactories.s.sol --rpc-url https://bsc-testnet-rpc.publicnode.com \
///     --account grailio-deployer --broadcast --slow --legacy --with-gas-price 100000000
contract DeployFactories is Script {
    /// @notice The testnet trade market (MockStockMarket with keeper + test USD sells), deployments/97.json "tradeMarket".
    address internal constant TRADE_MARKET = 0x99AC96c9a468DfAb571e0C562d455CA3678391c0;

    function run() external {
        require(block.chainid == 97, "BNB Testnet only");
        address market = vm.envOr("MARKET", TRADE_MARKET);
        address hub = LaunchVaultAddresses.hub();
        address guardian = LaunchVaultAddresses.guardian();

        vm.startBroadcast();
        (, address deployer,) = vm.readCallers();
        // The vault factory needs the launcher factory's address and vice versa: predict the second deployment.
        address predicted = vm.computeCreateAddress(deployer, vm.getNonce(deployer) + 1);
        // The deployer receives the platform's 5% share of vault tax.
        PackVaultFactory vaultFactory = new PackVaultFactory(predicted, market, deployer);
        PackLauncherFactory launcherFactory = new PackLauncherFactory(hub, guardian, address(vaultFactory));
        require(address(launcherFactory) == predicted, "launcher factory address prediction failed");
        vm.stopBroadcast();

        console2.log("market              ", market);
        console2.log("PackVaultFactory    ", address(vaultFactory));
        console2.log("PackLauncherFactory ", address(launcherFactory));
    }
}
