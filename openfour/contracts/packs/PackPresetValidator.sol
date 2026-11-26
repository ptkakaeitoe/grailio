// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IOpenFourPresetValidator} from "../openfour/interfaces/IOpenFourPresetValidator.sol";
import {OpenFourTypes} from "../openfour/libraries/OpenFourTypes.sol";
import {PackInputParams, PackParams} from "./PackParams.sol";
import {IStockMarket, PackOdds} from "./PackOdds.sol";

/// @title PackPresetValidator
/// @notice Create-time checks for the Grailio pack preset: FairLaunch fixed-price sale (sells off) + StandardVault +
///         FairLaunch CustomData (which records each buyer's purchases, i.e. their presale packs) + PackMigrateModule.
///
///         On top of FairLaunch's own rules it requires: sells disabled (presale packs are tokens bought, so they must
///         not shrink), the minimum purchase at least one pack, a basket of listed stocks with weights summing to 10000,
///         a known style, and a stock-pool share of at most 50%.
contract PackPresetValidator is IOpenFourPresetValidator {
    uint256 private constant TOKEN_UNIT = 1e18;
    uint16 private constant MAX_BPS = 10_000;

    /// @param expectedPresetId Non-zero: creation must use this preset id.
    /// @param requiredQuoteAsset Non-zero: creation must use this quote (WBNB).
    /// @param market The stock market the pack vault buys from; every basket stock must be listed there.
    /// @param minRaiseAmount Lower bound on the raise (zero disables).
    /// @param maxRaiseAmount Upper bound on the raise (zero disables).
    struct Bounds {
        uint256 expectedPresetId;
        address requiredQuoteAsset;
        address market;
        uint256 minRaiseAmount;
        uint256 maxRaiseAmount;
    }

    /// @dev Must match `FairLaunchCurveModule.Params`.
    struct CurveParams {
        uint256 fixedPrice;
        uint16 sellPenaltyBps;
        bool enableSell;
        uint256 minPurchase;
        uint256 maxPurchase;
    }

    /// @dev Must match `FairLaunchTradeModule.TradeConfig`.
    struct TradeConfig {
        uint256 maxBuyAmount;
        uint256 maxPerAddress;
        uint256 maxSellAmount;
        uint16 buyFeeBps;
        uint16 sellFeeBps;
        address feeRecipient;
    }

    Bounds public bounds;

    constructor(Bounds memory bounds_) {
        require(bounds_.market != address(0), "PackValidator: zero market");
        require(bounds_.maxRaiseAmount == 0 || bounds_.maxRaiseAmount >= bounds_.minRaiseAmount, "PackValidator: bad bounds");
        bounds = bounds_;
    }

    function validate(uint256 presetId, OpenFourTypes.TokenInitParams calldata params) external view override {
        Bounds memory b = bounds;
        if (b.expectedPresetId != 0) require(presetId == b.expectedPresetId, "PackValidator: wrong preset");

        require(bytes(params.name).length > 0 && bytes(params.symbol).length > 0, "PackValidator: empty name");
        require(params.maxSupply > 0 && params.saleAmount > 0, "PackValidator: zero supply");
        require(params.saleAmount <= params.maxSupply, "PackValidator: sale exceeds supply");
        require(params.quoteAsset != address(0), "PackValidator: zero quoteAsset");
        if (b.requiredQuoteAsset != address(0)) require(params.quoteAsset == b.requiredQuoteAsset, "PackValidator: bad quote");
        if (b.minRaiseAmount > 0) require(params.raiseAmount >= b.minRaiseAmount, "PackValidator: raise below min");
        if (b.maxRaiseAmount > 0) require(params.raiseAmount <= b.maxRaiseAmount, "PackValidator: raise above max");
        require(params.tokenParams.length == 0 && params.vaultParams.length == 0, "PackValidator: unexpected params");
        require(params.customDataParams.length == 0, "PackValidator: customDataParams not empty");

        CurveParams memory curve = abi.decode(params.curveParams, (CurveParams));
        TradeConfig memory trade = abi.decode(params.tradeParams, (TradeConfig));
        PackInputParams memory pack = abi.decode(params.migrateParams, (PackInputParams));

        // Fixed-price sale, sells off.
        require(curve.fixedPrice > 0, "PackValidator: zero price");
        require(!curve.enableSell && curve.sellPenaltyBps == 0, "PackValidator: sells must be off");
        require(curve.minPurchase > 0 && curve.maxPurchase >= curve.minPurchase, "PackValidator: bad purchase range");
        require(curve.maxPurchase <= params.saleAmount, "PackValidator: maxPurchase too large");
        require(params.raiseAmount == Math.mulDiv(params.saleAmount, curve.fixedPrice, TOKEN_UNIT), "PackValidator: raise mismatch");

        require(trade.maxBuyAmount >= curve.minPurchase && trade.maxBuyAmount <= curve.maxPurchase, "PackValidator: bad maxBuy");
        require(trade.maxSellAmount == 0 && trade.sellFeeBps == 0, "PackValidator: sells must be off");
        require(trade.buyFeeBps <= MAX_BPS, "PackValidator: fee too high");
        require(trade.buyFeeBps == 0 || trade.feeRecipient != address(0), "PackValidator: zero feeRecipient");
        if (trade.maxPerAddress > 0) {
            require(trade.maxPerAddress >= curve.minPurchase && trade.maxPerAddress <= params.saleAmount, "PackValidator: bad wallet cap");
        }

        // Packs.
        require(pack.stockPoolBps <= PackParams.MAX_STOCK_POOL_BPS, "PackValidator: stock pool share too high");
        require(pack.packPrice > 0 && pack.style < PackOdds.STYLES, "PackValidator: bad pack config");
        require(pack.tokensPerPack > 0 && curve.minPurchase >= pack.tokensPerPack, "PackValidator: min buy below one pack");
        require(pack.tokensPerPack <= params.saleAmount, "PackValidator: pack larger than sale");
        require(pack.softCap == 0 || pack.softCap <= params.raiseAmount, "PackValidator: softCap too high");
        if (pack.tokenLiquidityAmount > 0) {
            require(pack.tokenLiquidityAmount <= params.maxSupply - params.saleAmount, "PackValidator: liquidity too high");
        }
        (address[] memory stocks,) = PackParams.basket(pack);
        for (uint256 i; i < stocks.length; ++i) {
            require(IStockMarket(b.market).priceWei(stocks[i]) > 0, "PackValidator: stock not listed");
        }
    }
}
