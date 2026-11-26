// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {LibClone} from "solady/utils/LibClone.sol";
import {UpgradeableBeacon} from "solady/utils/UpgradeableBeacon.sol";
import {LauncherFactoryBase} from "src/flap/LauncherFactoryBase.sol";
import {LauncherDataSchema, FieldDescriptor} from "src/flap/IVaultSchemas.sol";
import {PackLauncher, PackConfig} from "./PackLauncher.sol";
import {PackVaultFactory} from "./PackVaultFactory.sol";

/// @title PackLauncherFactory
/// @notice Launcher factory for `PackLauncher`, the Launcher half of the pack Launcher + Vault pair.
///
///         Strict checks in `_newLauncher` (rejected, never defaulted):
///           - `data` is exactly one canonical `PackConfig`;
///           - `vaultFactory == pairedVaultFactory`, fixed at construction;
///           - the basket passes the paired vault factory's `checkBasket`;
///           - pack price, presale size, raise, window and seed share within bounds;
///           - non-empty name, symbol, salt.
///
///         Upgrades: Guardian only, through the beacon. No other privileged function.
contract PackLauncherFactory is LauncherFactoryBase {
    address public immutable hub;
    address public immutable guardian;
    address public immutable beacon;
    address public immutable pairedVaultFactory;

    uint256 public constant MIN_PACK_PRICE = 0.001 ether;
    uint256 public constant MAX_PACK_PRICE = 10 ether;
    uint256 public constant MAX_PACKS = 10_000;
    uint256 public constant MIN_RAISE = 0.1 ether;
    uint256 public constant MAX_RAISE = 10_000 ether;
    uint256 public constant MAX_SALE_DURATION = 30 days;
    uint16 public constant MAX_SEED_BPS = 5000;

    error ZeroAddress();
    error WrongVaultFactory(address got, address expected);
    error PackPriceOutOfRange(uint256 got);
    error PacksOutOfRange(uint256 got);
    error RaiseOutOfRange(uint256 got);
    error SaleDurationOutOfRange(uint256 got);
    error SeedBpsOutOfRange(uint256 got);
    error EmptyField();
    error InvalidData();

    event PackLauncherCreated(address indexed launcher, address indexed creator, bytes32 launchSalt);
    event FlapLauncherImplementationUpgraded(address implementation);

    constructor(address hub_, address guardian_, address pairedVaultFactory_) {
        if (hub_ == address(0) || guardian_ == address(0) || pairedVaultFactory_ == address(0)) revert ZeroAddress();
        hub = hub_;
        guardian = guardian_;
        pairedVaultFactory = pairedVaultFactory_;
        beacon = address(new UpgradeableBeacon(address(this), address(new PackLauncher())));
    }

    function _getHub() internal view override returns (address) {
        return hub;
    }

    function _getGuardian() internal view override returns (address) {
        return guardian;
    }

    function _newLauncher(address creator, bytes calldata data) internal override returns (address launcher) {
        PackConfig memory c = abi.decode(data, (PackConfig));
        if (keccak256(abi.encode(c)) != keccak256(data)) revert InvalidData();

        if (c.vaultFactory != pairedVaultFactory) revert WrongVaultFactory(c.vaultFactory, pairedVaultFactory);
        PackVaultFactory(pairedVaultFactory).checkBasket(c.basket);
        if (c.packPrice < MIN_PACK_PRICE || c.packPrice > MAX_PACK_PRICE) revert PackPriceOutOfRange(c.packPrice);
        if (c.packsForSale == 0 || c.packsForSale > MAX_PACKS) revert PacksOutOfRange(c.packsForSale);
        uint256 raise = c.packPrice * c.packsForSale;
        if (raise < MIN_RAISE || raise > MAX_RAISE) revert RaiseOutOfRange(raise);
        if (c.saleDuration == 0 || c.saleDuration > MAX_SALE_DURATION) revert SaleDurationOutOfRange(c.saleDuration);
        if (c.seedBps > MAX_SEED_BPS) revert SeedBpsOutOfRange(c.seedBps);
        if (bytes(c.name).length == 0 || bytes(c.symbol).length == 0 || c.salt == bytes32(0)) revert EmptyField();

        launcher = LibClone.deployDeterministicERC1967BeaconProxy(beacon, c.salt);
        PackLauncher(launcher).initialize{value: msg.value}(hub, creator, c);
        emit PackLauncherCreated(launcher, creator, c.salt);
    }

    function upgradeVaultImplementation(address newImplementation) external override onlyGuardian {
        UpgradeableBeacon(beacon).upgradeTo(newImplementation);
        emit FlapLauncherImplementationUpgraded(newImplementation);
    }

    function beaconImplementation() external view returns (address) {
        return UpgradeableBeacon(beacon).implementation();
    }

    function launcherDataSchema() external pure override returns (LauncherDataSchema memory schema) {
        schema.description =
            "Stock pack presale: packs sell before the coin exists. When they sell out the coin launches; most of the raise seeds the pool, the rest seeds a paired vault's stock pool, and buyers split 50% of the supply by packs held. 80% of the trading tax then refills the stock pool, packs open into card NFTs that hold tokenized stocks, and burning a card takes the stock out. If the packs do not sell out, buyers are refunded.";
        FieldDescriptor[] memory f = new FieldDescriptor[](10);
        f[0] = FieldDescriptor("name", "string", "Coin name", 0);
        f[1] = FieldDescriptor("symbol", "string", "Coin symbol", 0);
        f[2] = FieldDescriptor("meta", "string", "Metadata URI", 0);
        f[3] = FieldDescriptor("salt", "bytes32", "Vanity-mined launch salt", 0);
        f[4] = FieldDescriptor("packPrice", "uint256", "BNB per pack (0.001 to 10)", 18);
        f[5] = FieldDescriptor("packsForSale", "uint256", "Presale packs (1 to 10000)", 0);
        f[6] = FieldDescriptor("saleDuration", "uint256", "Presale window in seconds (max 30 days)", 0);
        f[7] = FieldDescriptor("vaultFactory", "address", "Must be the paired PackVaultFactory", 0);
        f[8] = FieldDescriptor("seedBps", "uint16", "Share of the raise for the stock pool (0-5000)", 0);
        f[9] = FieldDescriptor("basket", "bytes", "(market, stocks[], weights[], style)", 0);
        schema.fields = f;
    }
}
