const fs = require('fs');
const path = require('path');

const pagePath = path.join(__dirname, 'frontend', 'src', 'app', 'page.tsx');
let content = fs.readFileSync(pagePath, 'utf8');

// Update gas limit in handleSwap to 1000000
content = content.replace(/gas: toHex\(2000000\)/g, "gas: toHex(1000000)");

// Now we need to completely rewrite handleAddLiquidity to use raw RPC with gas limit
const oldAddLiqStart = '  // --- ADD LIQUIDITY SUBMIT ---';
const oldAddLiqEnd = '  // Check allowance for Token A';

const oldAddLiqBlock = content.substring(
  content.indexOf(oldAddLiqStart),
  content.indexOf(oldAddLiqEnd)
);

const newAddLiqBlock = `  // --- ADD LIQUIDITY SUBMIT ---
  const handleAddLiquidity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) return alert("Please connect your wallet first");
    if (!tokenA || !tokenB || !amountA || !amountB) return alert("Please fill all fields");
    if (!(window as any).ethereum) return alert("No wallet provider found in window.ethereum");
    if (!userAddress) return alert("User address missing");

    setIsAddingLiquidity(true);
    try {
      const parsedAmountA = parseEther(amountA);
      const parsedAmountB = parseEther(amountB);
      const checksummedUser = getAddress(userAddress);

      const sendRawTransaction = async (toAddress: string, dataHex: string, valueHex?: string) => {
        const checksummedTo = getAddress(toAddress);
        const txParams: any = {
          from: checksummedUser,
          to: checksummedTo,
          data: dataHex,
          gas: toHex(1000000), // Explicit gas limit for HashPack
        };
        if (valueHex) txParams.value = valueHex;

        const txHash = await (window as any).ethereum.request({
          method: 'eth_sendTransaction',
          params: [txParams]
        });
        
        return txHash;
      };

      // 1. Approve token A
      console.log("Approving Token A...");
      const approveDataA = encodeFunctionData({
        abi: [{ name: "approve", type: "function", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }] }],
        functionName: "approve",
        args: [getAddress(addresses.TradeEasyRouter as \`0x\${string}\`), parsedAmountA]
      });
      await sendRawTransaction(tokenA, approveDataA);

      // 2. Approve token B
      console.log("Approving Token B...");
      const approveDataB = encodeFunctionData({
        abi: [{ name: "approve", type: "function", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }] }],
        functionName: "approve",
        args: [getAddress(addresses.TradeEasyRouter as \`0x\${string}\`), parsedAmountB]
      });
      await sendRawTransaction(tokenB, approveDataB);

      // 3. Add Liquidity
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 600); // 10 mins
      console.log("Adding liquidity to pool...");
      
      const checksummedRouter = getAddress(addresses.TradeEasyRouter as \`0x\${string}\`);
      const addLiquidityData = encodeFunctionData({
        abi: TradeEasyRouterAbi,
        functionName: "addLiquidity",
        args: [
          getAddress(tokenA),
          getAddress(tokenB),
          parsedAmountA,
          parsedAmountB,
          0n, // slippage parameters set to 0 for demo simplicity
          0n,
          checksummedUser,
          deadline
        ]
      });

      const tx = await sendRawTransaction(checksummedRouter, addLiquidityData);

      alert(\`Liquidity added successfully! Hash: \${tx}\`);
      setAmountA("");
      setAmountB("");
    } catch (err: any) {
      console.error(err);
      alert(\`Failed to add liquidity: \${err.message || err}\`);
    } finally {
      setIsAddingLiquidity(false);
    }
  };

`;

content = content.replace(oldAddLiqBlock, newAddLiqBlock);
fs.writeFileSync(pagePath, content);
console.log("Patched page.tsx to explicitly inject gas limit into addLiquidity and handleSwap.");
