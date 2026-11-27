// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/token/ERC20/IERC20.sol";

interface IMintUsd {
    function mint(address to, uint256 amount) external;
}

interface IRouter {
    function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint256, uint256, address[] calldata, address, uint256) external;
}

interface ITaxToken {
    function taxProcessor() external view returns (address);
}

interface ITaxProcessor {
    function dispatch() external;
}

interface IVault {
    function sync() external;
    function pool() external view returns (uint256);
    function unrecognized() external view returns (uint256);
}

/// @notice Makes a few real trades of a Flap coin on PancakeSwap testnet with Flap's free test USD, so its 3% tax
///         reaches the pack vault and fills the stock pool: `ROUNDS` rounds of buy `BUY` USD, then sell 60% of the
///         coins held; then the tax processor dispatches and the vault splits what arrived.
///
///   COIN=0x… VAULT=0x… forge script script/TradeFlapCoin.s.sol --rpc-url https://bsc-testnet-rpc.publicnode.com \
///     --account grailio-deployer --broadcast --slow --legacy --with-gas-price 100000000
contract TradeFlapCoin is Script {
    IRouter internal constant ROUTER = IRouter(0xc9D63ddCB9549578057EAB6A83a543DdFEE2b8c3);
    address internal constant USD = 0x190C989D5665a0e404B444b53CAE9AbCfb600157;

    function run() external {
        require(block.chainid == 97, "BNB Testnet only");
        address coin = vm.envOr("COIN", address(0xB3269530734d67271f40E30e33d79805bC907777)); // Moon Vault
        IVault vault = IVault(vm.envOr("VAULT", address(0xD9A2931A5447E59E8476Dc1Bd40a9a8EBC054D8c)));
        uint256 rounds = vm.envOr("ROUNDS", uint256(4));
        uint256 buy = vm.envOr("BUY", uint256(400)) * 1 ether;

        address[] memory buyPath = new address[](2);
        buyPath[0] = USD;
        buyPath[1] = coin;
        address[] memory sellPath = new address[](2);
        sellPath[0] = coin;
        sellPath[1] = USD;

        vm.startBroadcast();
        (, address me,) = vm.readCallers();
        IMintUsd(USD).mint(me, buy * rounds);
        IERC20(USD).approve(address(ROUTER), type(uint256).max);
        IERC20(coin).approve(address(ROUTER), type(uint256).max);
        for (uint256 i; i < rounds; ++i) {
            ROUTER.swapExactTokensForTokensSupportingFeeOnTransferTokens(buy, 0, buyPath, me, block.timestamp + 600);
            uint256 sell = IERC20(coin).balanceOf(me) * 60 / 100;
            ROUTER.swapExactTokensForTokensSupportingFeeOnTransferTokens(sell, 0, sellPath, me, block.timestamp + 600);
        }
        ITaxProcessor(ITaxToken(coin).taxProcessor()).dispatch();
        vault.sync();
        vm.stopBroadcast();

        console2.log("stock pool (USD wei)", vault.pool());
    }
}
