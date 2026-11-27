// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/token/ERC20/IERC20.sol";

interface IOpenFourCore {
    function buy(address token, uint256 amount, uint256 maxPayAmount, uint256 options, bytes calldata proof) external payable;
}

interface ISaleVault {
    function remainingForSale() external view returns (uint256);
    function phase() external view returns (uint8);
}

interface IFactory {
    function getPair(address, address) external view returns (address);
}

interface IRouter {
    function getAmountsOut(uint256, address[] calldata) external view returns (uint256[] memory);
    function swapExactETHForTokensSupportingFeeOnTransferTokens(uint256, address[] calldata, address, uint256) external payable;
    function swapExactTokensForETHSupportingFeeOnTransferTokens(uint256, uint256, address[] calldata, address, uint256) external;
}

/// Orbit Club (our OpenFour testnet coin): selling out its presale migrates it to PancakeSwap, then it trades in tBNB
/// through the router the trade page uses.
///   BSC_TESTNET_RPC_URL=https://bsc-testnet-rpc.publicnode.com forge test --match-contract LiveFourSwapFork -vv
contract LiveFourSwapForkTest is Test {
    IOpenFourCore constant CORE = IOpenFourCore(0xb910c8FB21B64173befe38278DF476CE5fB1cAb1);
    ISaleVault constant SALE = ISaleVault(0x6A7B0dF7e5CC2e2b32400a69Fa77b8bD4E87E79F);
    address constant ORBITC = 0x1c5E728bcc382Db78083AA2C84F3AEF8eaBA8085;
    address constant WBNB = 0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd;
    IFactory constant FACTORY = IFactory(0x6725F303b657a9451d8BA641348b6761A6CC7a17);
    IRouter constant ROUTER = IRouter(0xD99D1c33F9fC3444f8101754aBC46c52416550D1);
    uint256 constant FIXED_PRICE = 500_000_000_000; // 0.0000005 BNB per coin
    address buyer = makeAddr("buyer");
    address trader = makeAddr("trader");

    function setUp() public {
        string memory rpc = vm.envOr("BSC_TESTNET_RPC_URL", string(""));
        if (bytes(rpc).length == 0) {
            vm.skip(true);
            return;
        }
        vm.createSelectFork(rpc);
        vm.deal(buyer, 1 ether);
        vm.deal(trader, 1 ether);
    }

    function test_sellOutMigratesThenTrades() public {
        uint256 left = SALE.remainingForSale();
        emit log_named_decimal_uint("left in sale", left, 18);
        uint256 maxPay = left * FIXED_PRICE / 1e18 * 120 / 100;
        vm.prank(buyer);
        CORE.buy{value: maxPay}(ORBITC, left, maxPay, 0, "");
        emit log_named_uint("phase after sell-out", SALE.phase());
        address pair = FACTORY.getPair(ORBITC, WBNB);
        assertTrue(pair != address(0), "migrated to a PancakeSwap pool");
        emit log_named_decimal_uint("pool tBNB", IERC20(WBNB).balanceOf(pair), 18);
        emit log_named_decimal_uint("pool ORBITC", IERC20(ORBITC).balanceOf(pair), 18);

        address[] memory buyPath = new address[](2);
        buyPath[0] = WBNB;
        buyPath[1] = ORBITC;
        vm.startPrank(trader);
        uint256 quote = ROUTER.getAmountsOut(0.001 ether, buyPath)[1];
        ROUTER.swapExactETHForTokensSupportingFeeOnTransferTokens{value: 0.001 ether}(quote * 90 / 100, buyPath, trader, block.timestamp + 600);
        uint256 got = IERC20(ORBITC).balanceOf(trader);
        emit log_named_decimal_uint("ORBITC bought", got, 18);
        assertGe(got, quote * 99 / 100);

        address[] memory sellPath = new address[](2);
        sellPath[0] = ORBITC;
        sellPath[1] = WBNB;
        IERC20(ORBITC).approve(address(ROUTER), type(uint256).max);
        uint256 back = ROUTER.getAmountsOut(got, sellPath)[1];
        uint256 before = trader.balance;
        ROUTER.swapExactTokensForETHSupportingFeeOnTransferTokens(got, back * 90 / 100, sellPath, trader, block.timestamp + 600);
        emit log_named_decimal_uint("tBNB back", trader.balance - before, 18);
        vm.stopPrank();
    }
}
