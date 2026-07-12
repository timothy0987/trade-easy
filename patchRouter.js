const fs = require('fs');
const path = require('path');

const routerPath = path.join(__dirname, 'contracts', 'contracts', 'TradeEasyRouter.sol');
let content = fs.readFileSync(routerPath, 'utf8');

// 1. Add IWETH interface
const wethInterface = `interface IWETH {
    function deposit() external payable;
    function transfer(address to, uint value) external returns (bool);
    function withdraw(uint) external;
}

contract TradeEasyRouter {`;

content = content.replace('contract TradeEasyRouter {', wethInterface);

// 2. Add WETH state var and receive function
const wethState = `    address public immutable factory;
    address public immutable WETH;

    modifier ensure(uint256 deadline) {
        require(deadline >= block.timestamp, 'TradeEasyRouter: EXPIRED');
        _;
    }

    constructor(address _factory, address _WETH) {
        factory = _factory;
        WETH = _WETH;
    }

    receive() external payable {
        assert(msg.sender == WETH); // only accept ETH via fallback from the WETH contract
    }`;

content = content.replace(/    address public immutable factory;[\s\S]*?constructor\(address _factory\) {\s*factory = _factory;\s*}/, wethState);

// 3. Add swapExactETHForTokens and swapExactTokensForETH at the end, before the last closing brace
const nativeSwaps = `
    // Swap Exact ETH For Tokens
    function swapExactETHForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable ensure(deadline) returns (uint256[] memory amounts) {
        require(path[0] == WETH, 'TradeEasyRouter: INVALID_PATH');
        amounts = getAmountsOut(msg.value, path);
        require(amounts[amounts.length - 1] >= amountOutMin, 'TradeEasyRouter: INSUFFICIENT_OUTPUT_AMOUNT');
        IWETH(WETH).deposit{value: amounts[0]}();
        assert(IWETH(WETH).transfer(TradeEasyFactory(factory).getPair(path[0], path[1]), amounts[0]));
        _swap(amounts, path, to);
    }

    // Swap Exact Tokens For ETH
    function swapExactTokensForETH(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256[] memory amounts) {
        require(path[path.length - 1] == WETH, 'TradeEasyRouter: INVALID_PATH');
        amounts = getAmountsOut(amountIn, path);
        require(amounts[amounts.length - 1] >= amountOutMin, 'TradeEasyRouter: INSUFFICIENT_OUTPUT_AMOUNT');
        
        address pair = TradeEasyFactory(factory).getPair(path[0], path[1]);
        IERC20(path[0]).transferFrom(msg.sender, pair, amounts[0]);
        _swap(amounts, path, address(this));
        
        IWETH(WETH).withdraw(amounts[amounts.length - 1]);
        (bool success,) = to.call{value: amounts[amounts.length - 1]}(new bytes(0));
        require(success, 'TradeEasyRouter: ETH_TRANSFER_FAILED');
    }
}
`;

content = content.replace('    }\n}\n', '    }' + nativeSwaps);

fs.writeFileSync(routerPath, content);
console.log("Patched TradeEasyRouter.sol with native payable functions!");
