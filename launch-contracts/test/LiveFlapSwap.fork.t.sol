// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/token/ERC20/IERC20.sol";

interface IMintUsd {
    function mint(address to, uint256 amount) external;
}

interface IRouter {
    function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint256, uint256, address[] calldata, address, uint256) external;
    function getAmountsOut(uint256, address[] calldata) external view returns (uint256[] memory);
}

/// Buying and selling Moon Vault (launched through our Flap launcher) on PancakeSwap testnet, the way the trade page does.
///   BSC_TESTNET_RPC_URL=https://bsc-testnet-rpc.publicnode.com forge test --match-contract LiveFlapSwapFork -vv
contract LiveFlapSwapForkTest is Test {
    IRouter constant ROUTER = IRouter(0xc9D63ddCB9549578057EAB6A83a543DdFEE2b8c3);
    address constant USD = 0x190C989D5665a0e404B444b53CAE9AbCfb600157;
    address constant MOONV = 0xB3269530734d67271f40E30e33d79805bC907777;
    address trader = makeAddr("trader");

    function setUp() public {
        string memory rpc = vm.envOr("BSC_TESTNET_RPC_URL", string(""));
        if (bytes(rpc).length == 0) {
            vm.skip(true);
            return;
        }
        vm.createSelectFork(rpc);
    }

    function test_buyThenSell() public {
        address[] memory buyPath = new address[](2);
        buyPath[0] = USD;
        buyPath[1] = MOONV;
        address[] memory sellPath = new address[](2);
        sellPath[0] = MOONV;
        sellPath[1] = USD;

        vm.startPrank(trader);
        IMintUsd(USD).mint(trader, 100 ether);
        IERC20(USD).approve(address(ROUTER), type(uint256).max);
        uint256 quote = ROUTER.getAmountsOut(100 ether, buyPath)[1];
        ROUTER.swapExactTokensForTokensSupportingFeeOnTransferTokens(100 ether, quote * 90 / 100, buyPath, trader, block.timestamp + 600);
        uint256 got = IERC20(MOONV).balanceOf(trader);
        emit log_named_decimal_uint("MOONV bought", got, 18);
        emit log_named_decimal_uint("quoted", quote, 18);
        assertGt(got, quote * 95 / 100);

        IERC20(MOONV).approve(address(ROUTER), type(uint256).max);
        uint256 sellQuote = ROUTER.getAmountsOut(got, sellPath)[1];
        uint256 before = IERC20(USD).balanceOf(trader);
        ROUTER.swapExactTokensForTokensSupportingFeeOnTransferTokens(got, sellQuote * 90 / 100 * 97 / 100, sellPath, trader, block.timestamp + 600);
        emit log_named_decimal_uint("USD back", IERC20(USD).balanceOf(trader) - before, 18);
        vm.stopPrank();
    }
}
