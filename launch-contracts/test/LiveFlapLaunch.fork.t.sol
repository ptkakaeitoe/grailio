// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/token/ERC20/IERC20.sol";
import {ClonesUpgradeable} from "@openzeppelin-contracts-upgradeable/proxy/ClonesUpgradeable.sol";
import {IPortal} from "src/flap/IPortal.sol";
import {PackLauncher, PackConfig} from "src/packs/PackLauncher.sol";
import {PackVault} from "src/packs/PackVault.sol";
import {PackBasket} from "src/packs/PackTypes.sol";

interface IMintUsd {
    function mint(address to, uint256 amount) external;
}

/// A launch through the factories deployed on BSC testnet, using the Portal exactly as it is now (no admin stand-in).
///   BSC_TESTNET_RPC_URL=https://bsc-testnet-rpc.publicnode.com forge test --match-contract LiveFlapLaunchFork -vv
contract LiveFlapLaunchForkTest is Test {
    IPortal constant PORTAL = IPortal(0x000042108465206185A077Edc3F3fd2b49060000);
    address constant TOKEN_IMPL = 0x7777c57ff7dc441c1715b2e36fa581c48B782222;
    address constant LAUNCHER_FACTORY = 0xeCEce195efEbFCb22064b4B621f2E7c68F5ecd72;
    address constant VAULT_FACTORY = 0x3362D7C576223FD9B96276BcdDD072f6e399E85f;
    address constant MARKET = 0x99AC96c9a468DfAb571e0C562d455CA3678391c0;
    address constant USD = 0x190C989D5665a0e404B444b53CAE9AbCfb600157;
    address constant NVDA = 0xe47425B5F0d9bbe0B5cCb7c5349927B4e813c725;
    address constant SPY = 0x7541E2A09e97122e22206c8a3A03bB5a7b8cb67d;

    address creator = makeAddr("creator");

    function setUp() public {
        string memory rpc = vm.envOr("BSC_TESTNET_RPC_URL", string(""));
        if (bytes(rpc).length == 0) {
            vm.skip(true);
            return;
        }
        vm.createSelectFork(rpc);
        vm.deal(creator, 1 ether);
    }

    function _salt() internal view returns (bytes32 salt) {
        for (uint256 i;; ++i) {
            salt = keccak256(abi.encode("grailio-live", i));
            if (uint16(uint160(ClonesUpgradeable.predictDeterministicAddress(TOKEN_IMPL, salt, address(PORTAL)))) == 0x7777) {
                return salt;
            }
        }
    }

    function test_liveLaunch() public {
        PackConfig memory c;
        c.name = "Grail Test";
        c.symbol = "GTEST";
        c.meta = "bafkreig4y5nwb4izyilbbmiydumvkld446d4k7j4ohg3x3q2lfel3fo4yq";
        c.salt = _salt();
        c.quoteToken = USD;
        c.packPrice = 220 ether;
        c.packsForSale = 10;
        c.saleDuration = 1 days;
        c.vaultFactory = VAULT_FACTORY;
        c.seedBps = 3000;
        PackBasket memory b;
        b.market = MARKET;
        b.stocks = new address[](2);
        b.stocks[0] = NVDA;
        b.stocks[1] = SPY;
        b.weights = new uint16[](2);
        b.weights[0] = 6000;
        b.weights[1] = 4000;
        c.basket = b;

        vm.prank(creator);
        PackLauncher launcher =
            PackLauncher(payable(PORTAL.newLauncher{value: PORTAL.SALT_LOCK_FEE()}(LAUNCHER_FACTORY, abi.encode(c))));
        emit log_named_address("launcher", address(launcher));

        for (uint256 i; i < 10; ++i) {
            address buyer = address(uint160(0xB000 + i));
            vm.startPrank(buyer);
            IMintUsd(USD).mint(buyer, c.packPrice);
            IERC20(USD).approve(address(launcher), c.packPrice);
            launcher.buyPacks(1);
            vm.stopPrank();
        }
        assertTrue(launcher.launched(), "sold out launches the coin");
        emit log_named_address("token", launcher.token());
        emit log_named_address("vault", launcher.vault());
        assertTrue(PackVault(payable(launcher.vault())).packPrice() > 0);
    }
}
