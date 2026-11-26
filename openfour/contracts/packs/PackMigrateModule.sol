// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {IOpenFourMigrateModule} from "../openfour/interfaces/IOpenFourMigrateModule.sol";
import {IOpenFourModuleSchema} from "../openfour/interfaces/IOpenFourModuleSchema.sol";
import {IOpenFourToken} from "../openfour/interfaces/IOpenFourToken.sol";
import {IOpenFourVault} from "../openfour/interfaces/IOpenFourVault.sol";
import {PancakeV2MigrateLib} from "../openfour/libraries/PancakeV2MigrateLib.sol";
import {OpenFourTypes, ParamDescriptor, ModuleEncodeSchema} from "../openfour/libraries/OpenFourTypes.sol";
import {OpenFourPackVault} from "./OpenFourPackVault.sol";
import {PackInputParams, PackParams} from "./PackParams.sol";
import {PackOdds} from "./PackOdds.sol";

/// @title PackMigrateModule
/// @notice Grailio's OpenFour migrate slot: the FairLaunch graduation (sold out / soft cap / timeout, then an
///         official-style PCS V2 pair with LP to 0xdead), except that `stockPoolBps` of the raise goes to the coin's
///         stock-pack vault instead of the pair.
///
///         - `init` clones an `OpenFourPackVault` for the coin, so its address is known from the first block and
///           inner-market buyers can see their presale packs.
///         - `executeMigration` sends the stock-pool share (WBNB) to that vault, unwraps it there, and seeds the pair
///           with the rest.
///         - The vault implementation and the stock market are fixed in this implementation's bytecode
///           (immutables), so a creator cannot point the pool at another market.
/// @dev Per-token clone; immutables are read from the implementation's code, which clones share.
contract PackMigrateModule is Initializable, IOpenFourMigrateModule, IOpenFourModuleSchema {
    address internal constant LP_RECIPIENT_DEAD = 0x000000000000000000000000000000000000dEaD;
    address internal constant BSC_V2_ROUTER = 0x10ED43C718714eb63d5aA57B78B54704E256024E;
    address internal constant BSC_TESTNET_V2_ROUTER = 0xD99D1c33F9fC3444f8101754aBC46c52416550D1;
    uint8 private constant PCS_V2_ENCODED_MIGRATED_DATA_V1 = 1;

    address public immutable vaultImplementation;
    address public immutable market;

    address public boundToken;
    address public fourCore;
    address public packVault;
    uint256 public softCap;
    uint256 public endTime;
    uint256 public tokenLiquidityAmount;
    uint16 public stockPoolBps;
    bytes private _initParams;
    string private _moduleVersion;

    event PackVaultCreated(address indexed token, address indexed vault);
    event StockPoolSeeded(address indexed token, address indexed vault, uint256 amount);

    modifier onlyFourCore() {
        require(msg.sender == fourCore, "PackMigrate: only fourCore");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address vaultImplementation_, address market_) {
        require(vaultImplementation_ != address(0) && market_ != address(0), "PackMigrate: zero address");
        vaultImplementation = vaultImplementation_;
        market = market_;
        _disableInitializers();
    }

    function init(address token, address fourCore_, address, bytes calldata rawParams, string calldata moduleVersion_)
        external
        override
        initializer
    {
        require(token != address(0) && fourCore_ != address(0), "PackMigrate: zero address");
        PackInputParams memory p = abi.decode(rawParams, (PackInputParams));
        require(p.stockPoolBps <= PackParams.MAX_STOCK_POOL_BPS, "PackMigrate: stock pool share too high");
        require(p.packPrice > 0 && p.tokensPerPack > 0 && p.style < PackOdds.STYLES, "PackMigrate: bad pack config");
        (address[] memory stocks, uint16[] memory weights) = PackParams.basket(p);

        boundToken = token;
        fourCore = fourCore_;
        softCap = p.softCap;
        endTime = block.timestamp + p.duration;
        tokenLiquidityAmount = p.tokenLiquidityAmount;
        stockPoolBps = p.stockPoolBps;
        _initParams = rawParams;
        _moduleVersion = moduleVersion_;

        address quote = _wbnb();
        address v = Clones.cloneDeterministic(vaultImplementation, bytes32(uint256(uint160(token))));
        OpenFourPackVault(payable(v)).initialize(token, quote, market, p.packPrice, p.tokensPerPack, p.style, stocks, weights);
        packVault = v;
        emit PackVaultCreated(token, v);
    }

    function descriptor() external view override returns (bytes8 tagId, string memory tag, string memory version) {
        tag = "module.migrate.grailio_packs";
        return (bytes8(keccak256(bytes(tag))), tag, _moduleVersion);
    }

    function evaluate(OpenFourTypes.MigrateContext calldata ctx)
        external
        view
        override
        onlyFourCore
        returns (OpenFourTypes.MigrateResult memory)
    {
        require(ctx.token == boundToken, "PackMigrate: wrong token");
        if (!_canMigrate(ctx.soldOut, ctx.totalRaised, ctx.timestamp)) {
            return OpenFourTypes.MigrateResult({canMigrate: false, data: "", reason: "Launch conditions not met"});
        }
        return OpenFourTypes.MigrateResult({canMigrate: true, data: abi.encode(ctx.totalRaised), reason: ""});
    }

    function executeMigration(OpenFourTypes.MigrateHookContext calldata ctx, bytes calldata)
        external
        override
        onlyFourCore
        returns (uint8 migratedDataVersion, bytes memory encodedMigratedData)
    {
        require(ctx.token == boundToken, "PackMigrate: wrong token");
        require(_canMigrate(ctx.remainingForSale <= 1e18, ctx.totalRaised, ctx.timestamp), "PackMigrate: conditions not met");
        require(ctx.quoteAsset == _wbnb(), "PackMigrate: quote must be WBNB");

        uint256 toPool = ctx.totalRaised * stockPoolBps / 10_000;
        if (toPool > 0) {
            IOpenFourVault(ctx.vault).transferQuoteForMigration(packVault, toPool);
            OpenFourPackVault(payable(packVault)).unwrap();
            emit StockPoolSeeded(ctx.token, packVault, toPool);
        }

        address router = _router();
        if (router == address(0)) return (0, "");

        PancakeV2MigrateLib.LiqParams memory lp;
        lp.router = router;
        lp.lpRecipient = LP_RECIPIENT_DEAD;
        lp.tokenLiquidityAmount = _tokenLiquidityAmount(ctx.token, ctx.vault);
        lp.quoteToUse = ctx.totalRaised - toPool;

        address pair = PancakeV2MigrateLib.executePancakeLiquidity(lp, ctx);
        require(pair != address(0), "PackMigrate: pair missing");
        IOpenFourToken(ctx.token).setMigratedPool(pair, true);
        return (PCS_V2_ENCODED_MIGRATED_DATA_V1, abi.encode(pair));
    }

    function getInitParams() external view returns (bytes memory) {
        return _initParams;
    }

    function moduleEncodeSchema() external pure override returns (ModuleEncodeSchema memory) {
        ParamDescriptor[] memory p = new ParamDescriptor[](15);
        p[0] = _d("softCap", "uint256", 18, "Soft cap (quote asset)", "0", "Reaching it migrates early; 0 disables.");
        p[1] = _d("duration", "uint256", 0, "Sale duration (seconds)", "86400", "The sale may migrate after this.");
        p[2] = _d("tokenLiquidityAmount", "uint256", 0, "Token liquidity amount", "0", "0 means maxSupply - sold.");
        p[3] = _d("stockPoolBps", "uint16", 0, "Stock pool share (bps)", "2000", "Share of the raise for the pack vault, 0-5000.");
        p[4] = _d("packPrice", "uint256", 18, "Pack price (BNB)", "0.005", "Price of a pack bought after launch.");
        p[5] = _d("tokensPerPack", "uint256", 0, "Tokens per presale pack", "50000000000000000000", "Tokens bought in the sale that earn one pack.");
        p[6] = _d("style", "uint8", 0, "Risk style", "1", "0 Steady, 1 Classic, 2 Moonshot.");
        p[7] = _d("stock0", "address", 0, "Stock 1", "", "Listed bStock.");
        p[8] = _d("stock1", "address", 0, "Stock 2", "0x0000000000000000000000000000000000000000", "Optional.");
        p[9] = _d("stock2", "address", 0, "Stock 3", "0x0000000000000000000000000000000000000000", "Optional.");
        p[10] = _d("stock3", "address", 0, "Stock 4", "0x0000000000000000000000000000000000000000", "Optional.");
        p[11] = _d("weight0", "uint16", 0, "Stock 1 weight (bps)", "10000", "Weights sum to 10000.");
        p[12] = _d("weight1", "uint16", 0, "Stock 2 weight (bps)", "0", "");
        p[13] = _d("weight2", "uint16", 0, "Stock 3 weight (bps)", "0", "");
        p[14] = _d("weight3", "uint16", 0, "Stock 4 weight (bps)", "0", "");
        return ModuleEncodeSchema("migrate", 1, p);
    }

    function _d(
        string memory name,
        string memory abiType,
        uint8 decimals,
        string memory title,
        string memory defaultValue,
        string memory hint
    ) private pure returns (ParamDescriptor memory) {
        return ParamDescriptor({
            name: name,
            abiType: abiType,
            decimals: decimals,
            optional: true,
            title: title,
            defaultValue: defaultValue,
            hint: hint,
            minValue: "",
            maxValue: ""
        });
    }

    function _canMigrate(bool soldOut, uint256 totalRaised, uint256 timestamp) internal view returns (bool) {
        return soldOut || (softCap > 0 && totalRaised >= softCap) || (timestamp >= endTime);
    }

    function _router() internal view returns (address) {
        if (block.chainid == 56) return BSC_V2_ROUTER;
        if (block.chainid == 97) return BSC_TESTNET_V2_ROUTER;
        return address(0);
    }

    /// @dev WBNB of this chain. Read from a constant, not the coin's Vault, because Core may init the Vault slot after
    ///      this one. `executeMigration` checks the coin really trades against it.
    function _wbnb() internal view returns (address) {
        if (block.chainid == 56) return 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c;
        return 0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd; // BSC Testnet (and local forks of it)
    }

    function _tokenLiquidityAmount(address token, address vault) internal view returns (uint256) {
        if (tokenLiquidityAmount > 0) return tokenLiquidityAmount;
        uint256 maxSupply = IOpenFourToken(token).maxSupply();
        uint256 sold = IOpenFourVault(vault).soldAmount();
        require(maxSupply > sold, "PackMigrate: no token liquidity");
        return maxSupply - sold;
    }
}
