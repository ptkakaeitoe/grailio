// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/token/ERC20/IERC20.sol";
import {ClonesUpgradeable} from "@openzeppelin-contracts-upgradeable/proxy/ClonesUpgradeable.sol";
import {IPortal} from "src/flap/IPortal.sol";
import {PackLauncher, PackConfig} from "src/packs/PackLauncher.sol";
import {PackBasket} from "src/packs/PackTypes.sol";

interface IMintUsd {
    function mint(address to, uint256 amount) external;
}

/// @notice Launches a test coin through our Flap launcher on BNB Testnet: opens the pack presale through the Portal,
///         mints Flap's free test USD and buys `BUY` of the 10 packs (all 10 sells out and launches the coin).
///
///   forge script script/LaunchFlapCoin.s.sol --rpc-url https://bsc-testnet-rpc.publicnode.com \
///     --account grailio-deployer --broadcast --slow --legacy --with-gas-price 100000000
contract LaunchFlapCoin is Script {
    IPortal internal constant PORTAL = IPortal(0x000042108465206185A077Edc3F3fd2b49060000);
    address internal constant TOKEN_IMPL = 0x7777c57ff7dc441c1715b2e36fa581c48B782222;
    address internal constant LAUNCHER_FACTORY = 0xeCEce195efEbFCb22064b4B621f2E7c68F5ecd72;
    address internal constant VAULT_FACTORY = 0x3362D7C576223FD9B96276BcdDD072f6e399E85f;
    address internal constant MARKET = 0x99AC96c9a468DfAb571e0C562d455CA3678391c0;
    address internal constant USD = 0x190C989D5665a0e404B444b53CAE9AbCfb600157;
    address internal constant NVDA = 0xe47425B5F0d9bbe0B5cCb7c5349927B4e813c725;
    address internal constant SPY = 0x7541E2A09e97122e22206c8a3A03bB5a7b8cb67d;
    address internal constant TSLA = 0x8bE8B7048567a4da7A99487dfA63b940D848b003;

    uint256 internal constant PACKS = 10;
    uint256 internal constant PACK_PRICE = 220 ether; // 10 x 220 test USD clears the Portal's 2,200 USD floor

    function _salt(bytes32 seed) internal pure returns (bytes32 salt) {
        for (uint256 i;; ++i) {
            salt = keccak256(abi.encode(seed, i));
            if (uint16(uint160(ClonesUpgradeable.predictDeterministicAddress(TOKEN_IMPL, salt, address(PORTAL)))) == 0x7777) {
                return salt;
            }
        }
    }

    function run() external {
        require(block.chainid == 97, "BNB Testnet only");
        uint256 buy = vm.envOr("BUY", PACKS);
        require(buy <= PACKS, "at most 10 packs");

        PackConfig memory c;
        c.name = vm.envOr("NAME", string("Moon Vault"));
        c.symbol = vm.envOr("SYMBOL", string("MOONV"));
        c.meta = "";
        c.salt = _salt(keccak256(abi.encode(c.symbol, block.timestamp)));
        c.quoteToken = USD;
        c.packPrice = PACK_PRICE;
        c.packsForSale = PACKS;
        c.saleDuration = 7 days;
        c.vaultFactory = VAULT_FACTORY;
        c.seedBps = 3000;
        PackBasket memory b;
        b.market = MARKET;
        b.stocks = new address[](3);
        b.stocks[0] = NVDA;
        b.stocks[1] = SPY;
        b.stocks[2] = TSLA;
        b.weights = new uint16[](3);
        b.weights[0] = 4000;
        b.weights[1] = 3500;
        b.weights[2] = 2500;
        c.basket = b;

        uint256 fee = PORTAL.SALT_LOCK_FEE();
        vm.startBroadcast();
        (, address me,) = vm.readCallers();
        PackLauncher launcher = PackLauncher(payable(PORTAL.newLauncher{value: fee}(LAUNCHER_FACTORY, abi.encode(c))));
        if (buy > 0) {
            IMintUsd(USD).mint(me, PACK_PRICE * buy);
            IERC20(USD).approve(address(launcher), PACK_PRICE * buy);
            launcher.buyPacks(buy);
        }
        vm.stopBroadcast();

        console2.log("creator  ", me);
        console2.log("launcher ", address(launcher));
        console2.log("launched ", launcher.launched());
        if (launcher.launched()) {
            console2.log("token    ", launcher.token());
            console2.log("vault    ", launcher.vault());
        }
    }
}
