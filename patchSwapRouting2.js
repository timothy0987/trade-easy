const fs = require('fs');
const path = require('path');

const pagePath = path.join(__dirname, 'frontend', 'src', 'app', 'page.tsx');
let content = fs.readFileSync(pagePath, 'utf8');

// Replace the swap execution block inside handleSwap
const oldSwapLogic = `        // Swap
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
        const path = [tokenA, tokenB];

        console.log("Executing swap...");
        const tx = await writeContractAsync({
          address: addresses.TradeEasyRouter as \`0x\${string}\`,
          abi: TradeEasyRouterAbi,
          functionName: "swapExactTokensForTokens",
          args: [
            parsedAmountIn,
            0n, // Min amount out
            path,
            userAddress,
            deadline
          ]
        });

        showToast(\`Swap completed successfully! Hash: \${tx}\`);
        setSwapAmountIn("");`;

const newSwapLogic = `        // Swap translation dictionary
        const WHBAR_ADDRESS = "0x000000000000000000000000000000000000016a";
        const tA = tokenA === "HBAR" ? WHBAR_ADDRESS : tokenA;
        const tB = tokenB === "HBAR" ? WHBAR_ADDRESS : tokenB;
        
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
        const path = [tA, tB];

        console.log("Executing swap with routing...");
        
        let tx;
        if (tokenA === "HBAR") {
          tx = await writeContractAsync({
            address: addresses.TradeEasyRouter as \`0x\${string}\`,
            abi: TradeEasyRouterAbi,
            functionName: "swapExactETHForTokens",
            value: parsedAmountIn,
            args: [
              0n, // Min amount out
              path,
              userAddress,
              deadline
            ]
          });
        } else if (tokenB === "HBAR") {
          tx = await writeContractAsync({
            address: addresses.TradeEasyRouter as \`0x\${string}\`,
            abi: TradeEasyRouterAbi,
            functionName: "swapExactTokensForETH",
            args: [
              parsedAmountIn,
              0n, // Min amount out
              path,
              userAddress,
              deadline
            ]
          });
        } else {
          tx = await writeContractAsync({
            address: addresses.TradeEasyRouter as \`0x\${string}\`,
            abi: TradeEasyRouterAbi,
            functionName: "swapExactTokensForTokens",
            args: [
              parsedAmountIn,
              0n, // Min amount out
              path,
              userAddress,
              deadline
            ]
          });
        }

        showToast(\`Swap completed successfully! Hash: \${tx}\`);
        setSwapAmountIn("");`;

if (content.includes('functionName: "swapExactTokensForTokens",')) {
  content = content.replace(oldSwapLogic, newSwapLogic);
  fs.writeFileSync(pagePath, content);
  console.log("Successfully patched page.tsx for swap routing!");
} else {
  console.log("Could not find the target swap logic string in page.tsx.");
}
