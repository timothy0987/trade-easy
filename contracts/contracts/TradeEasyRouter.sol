// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./TradeEasyFactory.sol";
import "./TradeEasyPair.sol";

contract TradeEasyRouter {
    address public immutable factory;

    modifier ensure(uint256 deadline) {
        require(deadline >= block.timestamp, 'TradeEasyRouter: EXPIRED');
        _;
    }

    constructor(address _factory) {
        factory = _factory;
    }

    // Helper: Sort tokens
    function sortTokens(address tokenA, address tokenB) internal pure returns (address token0, address token1) {
        require(tokenA != tokenB, 'TradeEasyRouter: IDENTICAL_ADDRESSES');
        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), 'TradeEasyRouter: ZERO_ADDRESS');
    }

    // Helper: Fetch reserves
    function getReserves(address tokenA, address tokenB) public view returns (uint256 reserveA, uint256 reserveB) {
        (address token0,) = sortTokens(tokenA, tokenB);
        address pair = TradeEasyFactory(factory).getPair(tokenA, tokenB);
        require(pair != address(0), 'TradeEasyRouter: PAIR_NOT_FOUND');
        (uint256 reserve0, uint256 reserve1,) = TradeEasyPair(pair).getReserves();
        (reserveA, reserveB) = tokenA == token0 ? (reserve0, reserve1) : (reserve1, reserve0);
    }

    // AMM library: Quote
    function quote(uint256 amountA, uint256 reserveA, uint256 reserveB) public pure returns (uint256 amountB) {
        require(amountA > 0, 'TradeEasyRouter: INSUFFICIENT_AMOUNT');
        require(reserveA > 0 && reserveB > 0, 'TradeEasyRouter: INSUFFICIENT_LIQUIDITY');
        amountB = (amountA * reserveB) / reserveA;
    }

    // AMM library: Get Amount Out
    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) public pure returns (uint256 amountOut) {
        require(amountIn > 0, 'TradeEasyRouter: INSUFFICIENT_INPUT_AMOUNT');
        require(reserveIn > 0 && reserveOut > 0, 'TradeEasyRouter: INSUFFICIENT_LIQUIDITY');
        uint256 amountInWithFee = amountIn * 997; // 0.3% fee
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 1000) + amountInWithFee;
        amountOut = numerator / denominator;
    }

    // AMM library: Get Amount In
    function getAmountIn(uint256 amountOut, uint256 reserveIn, uint256 reserveOut) public pure returns (uint256 amountIn) {
        require(amountOut > 0, 'TradeEasyRouter: INSUFFICIENT_OUTPUT_AMOUNT');
        require(reserveIn > 0 && reserveOut > 0, 'TradeEasyRouter: INSUFFICIENT_LIQUIDITY');
        uint256 numerator = reserveIn * amountOut * 1000;
        uint256 denominator = (reserveOut - amountOut) * 997;
        amountIn = (numerator / denominator) + 1;
    }

    // AMM library: Get Amounts Out
    function getAmountsOut(uint256 amountIn, address[] memory path) public view returns (uint256[] memory amounts) {
        require(path.length >= 2, 'TradeEasyRouter: INVALID_PATH');
        amounts = new uint256[](path.length);
        amounts[0] = amountIn;
        for (uint256 i = 0; i < path.length - 1; i++) {
            (uint256 reserveIn, uint256 reserveOut) = getReserves(path[i], path[i+1]);
            amounts[i+1] = getAmountOut(amounts[i], reserveIn, reserveOut);
        }
    }

    // AMM library: Get Amounts In
    function getAmountsIn(uint256 amountOut, address[] memory path) public view returns (uint256[] memory amounts) {
        require(path.length >= 2, 'TradeEasyRouter: INVALID_PATH');
        amounts = new uint256[](path.length);
        amounts[amounts.length - 1] = amountOut;
        for (uint256 i = path.length - 1; i > 0; i--) {
            (uint256 reserveIn, uint256 reserveOut) = getReserves(path[i-1], path[i]);
            amounts[i-1] = getAmountIn(amounts[i], reserveIn, reserveOut);
        }
    }

    // Add Liquidity
    function _addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin
    ) internal returns (uint256 amountA, uint256 amountB) {
        address pair = TradeEasyFactory(factory).getPair(tokenA, tokenB);
        if (pair == address(0)) {
            pair = TradeEasyFactory(factory).createPair(tokenA, tokenB);
        }
        (uint256 reserveA, uint256 reserveB) = getReserves(tokenA, tokenB);
        if (reserveA == 0 && reserveB == 0) {
            (amountA, amountB) = (amountADesired, amountBDesired);
        } else {
            uint256 amountBOptimal = quote(amountADesired, reserveA, reserveB);
            if (amountBOptimal <= amountBDesired) {
                require(amountBOptimal >= amountBMin, 'TradeEasyRouter: INSUFFICIENT_B_AMOUNT');
                (amountA, amountB) = (amountADesired, amountBOptimal);
            } else {
                uint256 amountAOptimal = quote(amountBDesired, reserveB, reserveA);
                assert(amountAOptimal <= amountADesired);
                require(amountAOptimal >= amountAMin, 'TradeEasyRouter: INSUFFICIENT_A_AMOUNT');
                (amountA, amountB) = (amountAOptimal, amountBDesired);
            }
        }
    }

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB, uint256 liquidity) {
        (amountA, amountB) = _addLiquidity(tokenA, tokenB, amountADesired, amountBDesired, amountAMin, amountBMin);
        address pair = TradeEasyFactory(factory).getPair(tokenA, tokenB);
        
        // Transfer tokens to the pair contract
        IERC20(tokenA).transferFrom(msg.sender, pair, amountA);
        IERC20(tokenB).transferFrom(msg.sender, pair, amountB);
        
        // Mint LP tokens to the destination address
        liquidity = TradeEasyPair(pair).mint(to);
    }

    // Remove Liquidity
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256 amountA, uint256 amountB) {
        address pair = TradeEasyFactory(factory).getPair(tokenA, tokenB);
        require(pair != address(0), 'TradeEasyRouter: PAIR_NOT_FOUND');
        
        // Send LP tokens back to the pair contract
        TradeEasyPair(pair).transferFrom(msg.sender, pair, liquidity);
        
        // Burn LP tokens to release the underlying assets
        (amountA, amountB) = TradeEasyPair(pair).burn(to);
        
        // Check slippage limits
        (address token0,) = sortTokens(tokenA, tokenB);
        (uint256 amountAOut, uint256 amountBOut) = tokenA == token0 ? (amountA, amountB) : (amountB, amountA);
        require(amountAOut >= amountAMin, 'TradeEasyRouter: INSUFFICIENT_A_AMOUNT');
        require(amountBOut >= amountBMin, 'TradeEasyRouter: INSUFFICIENT_B_AMOUNT');
    }

    // Swap Exact Tokens For Tokens
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256[] memory amounts) {
        amounts = getAmountsOut(amountIn, path);
        require(amounts[amounts.length - 1] >= amountOutMin, 'TradeEasyRouter: INSUFFICIENT_OUTPUT_AMOUNT');
        
        // Send token to the first pair
        address pair = TradeEasyFactory(factory).getPair(path[0], path[1]);
        IERC20(path[0]).transferFrom(msg.sender, pair, amounts[0]);
        
        _swap(amounts, path, to);
    }

    // Internal swap function
    function _swap(uint256[] memory amounts, address[] memory path, address _to) internal {
        for (uint256 i = 0; i < path.length - 1; i++) {
            (address input, address output) = (path[i], path[i+1]);
            (address token0,) = sortTokens(input, output);
            uint256 amountOut = amounts[i+1];
            (uint256 amount0Out, uint256 amount1Out) = input == token0 ? (uint256(0), amountOut) : (amountOut, uint256(0));
            address to = i < path.length - 2 ? TradeEasyFactory(factory).getPair(output, path[i+2]) : _to;
            TradeEasyPair(TradeEasyFactory(factory).getPair(input, output)).swap(amount0Out, amount1Out, to);
        }
    }
}
