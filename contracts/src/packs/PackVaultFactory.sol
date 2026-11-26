// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPortal, IPortalTypes} from "src/flap/IPortal.sol";
import {LibClone} from "solady/utils/LibClone.sol";
import {UpgradeableBeacon} from "solady/utils/UpgradeableBeacon.sol";
import {DirectLaunchVaultFactoryBase} from "src/flap/DirectLaunchVaultFactoryBase.sol";
import {Distribution} from "src/flap/Distribution.sol";
import {VaultDataSchema, FieldDescriptor, FactoryPolicy} from "src/flap/IVaultSchemas.sol";
import {IStockMarket} from "src/stocks/MockStockMarket.sol";
import {PackVault} from "./PackVault.sol";
import {PackBasket, PackOdds, IPackLauncher} from "./PackTypes.sol";

/// @title PackVaultFactory
/// @notice Vault factory paired with `PackLauncherFactory`. It only serves Launchers that factory created, so a
///         vault's packs always come from a real, sold-out pack presale.
///
///         What `newVault` checks before it deploys (rejected, never defaulted):
///           1. the caller is the Portal, and the common launch checks pass;
///           2. the launch caller is a Launcher the Portal recorded for `launcherFactory`;
///           3. `vaultData` is exactly `abi.encode(launcher, basket, packPrice)`, naming the calling Launcher, with
///              its pack price;
///           4. the basket is valid (`checkBasket`): this factory's market, 1-4 listed stocks, weights summing to
///              10000;
///           5. the quote is the launcher's and the market supports it, and the VAULT slot takes all of the tax;
///           6. no reserve is routed to the vault;
///           7. the Launcher is mid-launch and sold out.
contract PackVaultFactory is DirectLaunchVaultFactoryBase {
    address public immutable beacon;
    address public immutable launcherFactory;
    /// @notice The only stock market a vault may buy from.
    address public immutable market;
    /// @notice Receives the platform's 5% of every vault's tax.
    address public immutable platform;

    uint16 public constant VAULT_SLOT_BPS = 10_000;
    uint256 public constant MAX_STOCKS = 4;

    error NotFromLauncherFactory(address launcher);
    error VaultDataLauncherMismatch(address expected, address got);
    error PackPriceMismatch(uint256 got, uint256 expected);
    error VaultSlotBpsMismatch(uint16 got, uint16 expected);
    error QuoteMismatch(address launch, address launcher);
    error LauncherNotLaunching(address launcher);
    error LauncherNotSoldOut(uint256 sold, uint256 forSale);
    error WrongMarket(address got, address expected);
    error BadBasket();
    error StockNotListed(address stock);

    event FlapVaultImplementationUpgraded(address implementation);
    event PackVaultCreated(address indexed vault, address indexed token, address indexed launcher);

    constructor(address launcherFactory_, address market_, address platform_) {
        if (launcherFactory_ == address(0) || market_ == address(0) || platform_ == address(0)) revert ZeroAddress();
        launcherFactory = launcherFactory_;
        market = market_;
        platform = platform_;
        beacon = address(new UpgradeableBeacon(address(this), address(new PackVault())));
    }

    /// @notice Reverts unless `b` is a basket a vault of this factory can serve.
    function checkBasket(PackBasket memory b) public view {
        if (b.market != market) revert WrongMarket(b.market, market);
        uint256 n = b.stocks.length;
        if (n == 0 || n > MAX_STOCKS || b.weights.length != n) revert BadBasket();
        uint256 total;
        for (uint256 i; i < n; ++i) {
            if (b.weights[i] == 0) revert BadBasket();
            for (uint256 j; j < i; ++j) {
                if (b.stocks[j] == b.stocks[i]) revert BadBasket();
            }
            if (IStockMarket(market).priceIn(b.stocks[i], address(0)) == 0) revert StockNotListed(b.stocks[i]);
            total += b.weights[i];
        }
        if (total != 10_000) revert BadBasket();
    }

    /// @inheritdoc DirectLaunchVaultFactoryBase
    function newVault(address token, address creator, uint8 launchKind, bytes calldata launchParams)
        external
        override
        onlyHub
        returns (address vault)
    {
        (IPortalTypes.CreateTaxTokenParams memory p, Distribution memory d, bytes memory vaultData) =
            _validateLaunch(token, creator, launchKind, launchParams);
        _requireNoReserveDistribution(d);

        if (IPortal(_getHub()).getLauncher(creator).launcherFactory != launcherFactory) {
            revert NotFromLauncherFactory(creator);
        }

        (address named, PackBasket memory b, uint256 packPrice) = abi.decode(vaultData, (address, PackBasket, uint256));
        if (keccak256(abi.encode(named, b, packPrice)) != keccak256(vaultData)) revert InvalidVaultData();
        if (named != creator) revert VaultDataLauncherMismatch(creator, named);
        IPackLauncher l = IPackLauncher(creator);
        if (packPrice != l.packPrice()) revert PackPriceMismatch(packPrice, l.packPrice());
        checkBasket(b);

        if (p.quoteToken != l.quoteToken()) revert QuoteMismatch(p.quoteToken, l.quoteToken());
        uint16 slotBps = _vaultSlotBps(p.feeConfigs);
        if (slotBps != VAULT_SLOT_BPS) revert VaultSlotBpsMismatch(slotBps, VAULT_SLOT_BPS);

        if (!l.launching()) revert LauncherNotLaunching(creator);
        if (l.packsSold() != l.packsForSale()) revert LauncherNotSoldOut(l.packsSold(), l.packsForSale());

        vault = LibClone.deployDeterministicERC1967BeaconProxy(beacon, bytes32(uint256(uint160(token))));
        PackVault(payable(vault)).initialize(token, creator, b, packPrice, p.quoteToken, platform);
        emit PackVaultCreated(vault, token, creator);
    }

    function _vaultSlotBps(IPortalTypes.FeeConfig[] memory fees) internal view returns (uint16) {
        for (uint256 i; i < fees.length; ++i) {
            if (fees[i].feeType != IPortalTypes.FeeSlotType.VAULT) continue;
            IPortalTypes.FeeConfigVault memory v = abi.decode(fees[i].configData, (IPortalTypes.FeeConfigVault));
            if (v.vaultFactory == address(this)) return fees[i].bps;
        }
        return 0;
    }

    /// @inheritdoc DirectLaunchVaultFactoryBase
    function vaultDataSchema() public pure override returns (VaultDataSchema memory schema) {
        schema.description =
            "Pack vault: splits the coin's tax 50% stock pool / 30% card stakers / 15% creator / 5% platform and turns it into stock packs for the launching PackLauncher. Set by the launcher, not by hand.";
        schema.fields = new FieldDescriptor[](3);
        schema.fields[0] = FieldDescriptor("launcher", "address", "The PackLauncher that is launching", 0);
        schema.fields[1] = FieldDescriptor("basket", "bytes", "(market, stocks[], weights[])", 0);
        schema.fields[2] = FieldDescriptor("packPrice", "uint256", "Pack price in the quote", 18);
    }

    /// @inheritdoc DirectLaunchVaultFactoryBase
    function isQuoteTokenSupported(address quoteToken) public view override returns (bool) {
        return IStockMarket(market).isQuote(quoteToken);
    }

    /// @inheritdoc DirectLaunchVaultFactoryBase
    function tokenCreationPolicies() public pure override returns (FactoryPolicy[] memory policies) {
        policies = new FactoryPolicy[](2);
        policies[0] = FactoryPolicy({
            target: "quoteToken",
            operator: "in",
            value: "",
            description: "Native BNB, or an ERC20 quote the paired stock market supports (isQuoteTokenSupported)."
        });
        policies[1] = FactoryPolicy({
            target: "vaultSlotBps",
            operator: "eq",
            value: abi.encode(uint256(VAULT_SLOT_BPS)),
            description: "The VAULT slot must take all of the tax."
        });
    }

    function upgradeVaultImplementation(address newImplementation) external override onlyGuardian {
        UpgradeableBeacon(beacon).upgradeTo(newImplementation);
        emit FlapVaultImplementationUpgraded(newImplementation);
    }

    function beaconImplementation() external view returns (address) {
        return UpgradeableBeacon(beacon).implementation();
    }
}
