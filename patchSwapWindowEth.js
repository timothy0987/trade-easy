const fs = require('fs');
const path = require('path');

const pagePath = path.join(__dirname, 'frontend', 'src', 'app', 'page.tsx');
let content = fs.readFileSync(pagePath, 'utf8');

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
    if (!(window as any).ethereum) return showToast("No wallet provider found in window.ethereum");
    if (!userAddress) return showToast("User address missing");

    setIsSwapping(true);
    try {
      const parsedAmountIn = parseEther(swapAmountIn);
      const checksummedUser = getAddress(userAddress);

      const sendRawTransaction = async (toAddress: string, dataHex: string, valueHex?: string) => {
        const checksummedTo = getAddress(toAddress);
        const txParams: any = {
          from: checksummedUser,
          to: checksummedTo,
          data: dataHex,
          gas: toHex(2000000), // Hardcoded gas limit to prevent HashPack gas estimation failures
        };
        if (valueHex) txParams.value = valueHex;

        // Bypass viem completely and use the window.ethereum provider directly
        const txHash = await (window as any).ethereum.request({
          method: 'eth_sendTransaction',
          params: [txParams]
        });
        
        return txHash;
      };

      if (needsApproval) {
        console.log("Approving Token In...");
        
        const approveData = encodeFunctionData({
          abi: [{ name: "approve", type: "function", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }] }],
          functionName: "approve",
          args: [getAddress(addresses.TradeEasyRouter as \`0x\${string}\`), parsedAmountIn]
        });

        await sendRawTransaction(tokenA, approveData);
        
        await refetchAllowance();
        showToast("Approval successful. You can now execute the swap.");
      } else {
        const WHBAR_ADDRESS = getAddress("0x000000000000000000000000000000000000016a");
        const tA = tokenA === "HBAR" ? WHBAR_ADDRESS : getAddress(tokenA);
        const tB = tokenB === "HBAR" ? WHBAR_ADDRESS : getAddress(tokenB);
        
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200); // 20 minutes
        const path = [tA, tB];
        const checksummedRouter = getAddress(addresses.TradeEasyRouter as \`0x\${string}\`);

        console.log("Executing swap with raw RPC routing via window.ethereum...");
        
        let tx;
        if (tokenA === "HBAR") {
          const swapData = encodeFunctionData({
            abi: TradeEasyRouterAbi,
            functionName: "swapExactETHForTokens",
            args: [0n, path, checksummedUser, deadline]
          });
          tx = await sendRawTransaction(checksummedRouter, swapData, toHex(parsedAmountIn));
        } else if (tokenB === "HBAR") {
          const swapData = encodeFunctionData({
            abi: TradeEasyRouterAbi,
            functionName: "swapExactTokensForETH",
            args: [parsedAmountIn, 0n, path, checksummedUser, deadline]
          });
          tx = await sendRawTransaction(checksummedRouter, swapData);
        } else {
          const swapData = encodeFunctionData({
            abi: TradeEasyRouterAbi,
            functionName: "swapExactTokensForTokens",
            args: [parsedAmountIn, 0n, path, checksummedUser, deadline]
          });
          tx = await sendRawTransaction(checksummedRouter, swapData);
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
console.log("Patched page.tsx to bypass Viem using window.ethereum directly and hardcoding gas.");
