// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/token/ERC20/IERC20.sol";
import {IPortal} from "src/flap/IPortal.sol";
import {PackLauncher} from "src/packs/PackLauncher.sol";
import {PackVault} from "src/packs/PackVault.sol";

interface IProxyAdminOwner {
    function owner() external view returns (address);
}

interface IMintUsd {
    function mint(address to, uint256 amount) external;
}

/// The app's Flap launch, byte for byte, against the factories already deployed on BSC testnet: the PackConfig the
/// app encodes (src/lib/flap.ts, salt mined in the browser) goes to Portal.newLauncher, ten wallets buy the presale
/// with Flap's free-mint test USD, the last pack launches the coin, and a Low pack opens into a card holding a bStock.
/// The only stand-in is Flap's admin turning our two factories on, which Flap does once on the real network.
///   APP_PACK_CONFIG=0x… BSC_TESTNET_RPC_URL=https://bsc-testnet-rpc.publicnode.com \
///     forge test --match-contract AppFlapLaunchFork -vv
contract AppFlapLaunchForkTest is Test {
    IPortal constant PORTAL = IPortal(0x000042108465206185A077Edc3F3fd2b49060000);
    address constant PROXY_ADMIN = 0x0000Ed588dfc01749C20bA69b5f8c77d706E0000;
    address constant LAUNCHER_FACTORY = 0xBD8fd9B24054A4332B54e43f77c14304C0cA6B61;
    address constant VAULT_FACTORY = 0x975CB1bAEAA498B276EdC455681dEFe605Ca2EF7;
    address constant USD = 0x190C989D5665a0e404B444b53CAE9AbCfb600157;

    bytes config;
    address creator = makeAddr("creator");

    function setUp() public {
        string memory rpc = vm.envOr("BSC_TESTNET_RPC_URL", string(""));
        config = vm.envOr("APP_PACK_CONFIG", bytes(""));
        if (bytes(rpc).length == 0 || config.length == 0) {
            vm.skip(true);
            return;
        }
        vm.createSelectFork(rpc);
        address admin = IProxyAdminOwner(PROXY_ADMIN).owner();
        vm.startPrank(admin);
        PORTAL.setLauncherFactoryMultiplier(LAUNCHER_FACTORY, 10_000, true);
        PORTAL.setVaultFactoryMultiplier(VAULT_FACTORY, 10_000, true);
        vm.stopPrank();
        vm.deal(creator, 1 ether);
    }

    function test_appConfigLaunchesAndOpensACard() public {
        vm.prank(creator);
        PackLauncher launcher = PackLauncher(payable(PORTAL.newLauncher{value: PORTAL.SALT_LOCK_FEE()}(LAUNCHER_FACTORY, config)));
        assertEq(launcher.quoteToken(), USD);
        uint256 price = launcher.packPrice();
        uint256 packs = launcher.packsForSale();
        assertGe(price * packs, 2200 ether, "raise clears the Portal floor");

        for (uint256 i; i < packs; ++i) {
            address buyer = address(uint160(0xB000 + i));
            vm.startPrank(buyer);
            IMintUsd(USD).mint(buyer, price);
            IERC20(USD).approve(address(launcher), price);
            launcher.buyPacks(1);
            vm.stopPrank();
        }
        assertTrue(launcher.launched(), "last pack launched the coin");
        address token = launcher.token();
        assertEq(uint16(uint160(token)), 0x7777, "browser-mined salt gives a 7777 token");
        PackVault vault = PackVault(payable(launcher.vault()));
        assertTrue(address(vault) != address(0));

        // Anyone: buy and open a Low pack with test USD.
        address alice = makeAddr("alice");
        uint256 cost = vault.packPrice();
        vm.startPrank(alice);
        IMintUsd(USD).mint(alice, cost);
        IERC20(USD).approve(address(vault), cost);
        vault.buy(0, 1);
        uint256 id = vault.open(0);
        vm.stopPrank();
        vm.roll(block.number + 2);
        uint256 cardId = vault.reveal(id);
        assertEq(vault.ownerOf(cardId), alice, "card minted to the buyer");
    }
}
