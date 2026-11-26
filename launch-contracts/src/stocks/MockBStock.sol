// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "solady/tokens/ERC20.sol";

/// @title MockBStock
/// @notice Testnet stand-in for a tokenized stock (a "bStock" such as TSLAB). 18 decimals. Only its market mints and
///         burns, so the supply always matches what the market sold.
contract MockBStock is ERC20 {
    address public immutable market;
    string private _name;
    string private _symbol;

    error OnlyMarket();

    constructor(string memory name_, string memory symbol_, address market_) {
        _name = name_;
        _symbol = symbol_;
        market = market_;
    }

    function name() public view override returns (string memory) {
        return _name;
    }

    function symbol() public view override returns (string memory) {
        return _symbol;
    }

    function mint(address to, uint256 amount) external {
        if (msg.sender != market) revert OnlyMarket();
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        if (msg.sender != market) revert OnlyMarket();
        _burn(from, amount);
    }
}
