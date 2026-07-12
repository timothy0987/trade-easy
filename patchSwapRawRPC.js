const fs = require('fs');
const path = require('path');

const pagePath = path.join(__dirname, 'frontend', 'src', 'app', 'page.tsx');
let content = fs.readFileSync(pagePath, 'utf8');

// 1. Update wagmi imports
if (!content.includes('useWalletClient')) {
  content = content.replace('usePublicClient \n} from "wagmi";', 'usePublicClient,\n  useWalletClient \n} from "wagmi";');
}

// 2. Update viem imports
if (!content.includes('encodeFunctionData')) {
  content = content.replace('import { parseEther, formatEther } from "viem";', 'import { parseEther, formatEther, encodeFunctionData, toHex } from "viem";');
}

// 3. Add useWalletClient to Home
if (!content.includes('const { data: walletClient } = useWalletClient();')) {
  content = content.replace('const publicClient = usePublicClient();', 'const publicClient = usePublicClient();\n  const { data: walletClient } = useWalletClient();');
}

// 4. Overwrite handleSwap
const oldSwapCodeStart = '  // --- SWAP SUBMIT ---';
const oldSwapCodeEnd = '  // --- AGENT COMMAND SUBMIT ---';

const oldSwapBlock = content.substring(
  content.indexOf(oldSwapCodeStart),
  content.indexOf(oldSwapCodeEnd)
);

const newSwapCode = `  // --- SWAP SUBMIT ---
  const handleSwap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) return showToast("Please connect your wallet");
    if (!tokenA || !tokenB || !swapAmountIn) return showToast("Please fill all fields");
    if (!walletClient && !(window as any).ethereum) return showToast("No wallet client found");

    setIsSwapping(true);
    try {
      const parsedAmountIn = parseEther(swapAmountIn);

      const sendRawTransaction = async (toAddress: string, dataHex: string, valueHex?: string) => {
        const txParams: any = {
          from: userAddress,
          to: toAddress,
          data: dataHex,
        };
        if (valueHex) txParams.value = valueHex;

        let txHash;
        if (walletClient) {
          txHash = await walletClient.request({
            method: 'eth_sendTransaction',
            params: [txParams]
          });
        } else {
          txHash = await (window as any).ethereum.request({
            method: 'eth_sendTransaction',
            params: [txParams]
          });
        }
        return txHash;
      };

      if (needsApproval) {
        console.log("Approving Token In...");
        
        const approveData = encodeFunctionData({
          abi: [{ name: "approve", type: "function", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }] }],
          functionName: "approve",
          args: [addresses.TradeEasyRouter as \`0x\${string}\`, parsedAmountIn]
        });

        await sendRawTransaction(tokenA, approveData);
        
        await refetchAllowance();
        showToast("Approval successful. You can now execute the swap.");
      } else {
        const WHBAR_ADDRESS = "0x000000000000000000000000000000000000016a";
        const tA = tokenA === "HBAR" ? WHBAR_ADDRESS : tokenA;
        const tB = tokenB === "HBAR" ? WHBAR_ADDRESS : tokenB;
        
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
        const path = [tA, tB];

        console.log("Executing swap with raw RPC routing...");
        
        let tx;
        if (tokenA === "HBAR") {
          const swapData = encodeFunctionData({
            abi: TradeEasyRouterAbi,
            functionName: "swapExactETHForTokens",
            args: [0n, path, userAddress, deadline]
          });
          tx = await sendRawTransaction(addresses.TradeEasyRouter, swapData, toHex(parsedAmountIn));
        } else if (tokenB === "HBAR") {
          const swapData = encodeFunctionData({
            abi: TradeEasyRouterAbi,
            functionName: "swapExactTokensForETH",
            args: [parsedAmountIn, 0n, path, userAddress, deadline]
          });
          tx = await sendRawTransaction(addresses.TradeEasyRouter, swapData);
        } else {
          const swapData = encodeFunctionData({
            abi: TradeEasyRouterAbi,
            functionName: "swapExactTokensForTokens",
            args: [parsedAmountIn, 0n, path, userAddress, deadline]
          });
          tx = await sendRawTransaction(addresses.TradeEasyRouter, swapData);
        }

        showToast(\`Swap completed successfully! Hash: \${tx}\`);
        setSwapAmountIn("");
      }
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes("User rejected") || err.message?.includes("User denied") || err.code === 4001 || err.message?.includes("4001")) {
        showToast("Transaction rejected by user.");
      } else {
        showToast(\`Swap failed: \${err.message || err}\`);
      }
    } finally {
      setIsSwapping(false);
    }
  };

`;

content = content.replace(oldSwapBlock, newSwapCode);
fs.writeFileSync(pagePath, content);
console.log("Patched page.tsx with raw JSON-RPC swap execution.");
