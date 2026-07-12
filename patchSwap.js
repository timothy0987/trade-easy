const fs = require('fs');
const path = require('path');

const pagePath = path.join(__dirname, 'frontend', 'src', 'app', 'page.tsx');
let content = fs.readFileSync(pagePath, 'utf8');

// 1. Add Toast State right after isSwapping state
if (!content.includes('const [toastMessage, setToastMessage]')) {
  content = content.replace(
    'const [isSwapping, setIsSwapping] = useState(false);',
    'const [isSwapping, setIsSwapping] = useState(false);\n  const [toastMessage, setToastMessage] = useState("");\n  const showToast = (msg: string) => {\n    setToastMessage(msg);\n    setTimeout(() => setToastMessage(""), 5000);\n  };'
  );
}

// 2. Add Allowance Read Contract before handleSwap
const allowanceLogic = `
  // Check allowance for Token A
  const { data: tokenAAllowance, refetch: refetchAllowance } = useReadContract({
    address: tokenA && tokenA !== "HBAR" ? tokenA as \`0x\${string}\` : undefined,
    abi: [{ name: "allowance", type: "function", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] }],
    functionName: "allowance",
    args: userAddress && addresses.TradeEasyRouter ? [userAddress, addresses.TradeEasyRouter as \`0x\${string}\`] : undefined,
    query: {
      enabled: !!userAddress && !!tokenA && tokenA !== "HBAR",
    }
  });

  const parsedSwapAmountIn = swapAmountIn ? parseEther(swapAmountIn) : 0n;
  const needsApproval = tokenA !== "HBAR" && tokenA !== "" && tokenAAllowance !== undefined && (tokenAAllowance as bigint) < parsedSwapAmountIn;

  // --- SWAP SUBMIT ---`;

content = content.replace('  // --- SWAP SUBMIT ---', allowanceLogic);

// 3. Replace handleSwap implementation
const oldHandleSwap = `  const handleSwap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) return alert("Please connect your wallet");
    if (!tokenA || !tokenB || !swapAmountIn) return alert("Please fill all fields");

    setIsSwapping(true);
    try {
      const parsedAmountIn = parseEther(swapAmountIn);

      // Approve router to spend tokenA
      const tokenAContract = {
        address: tokenA as \`0x\${string}\`,
        abi: [
          {
            name: "approve",
            type: "function",
            stateMutability: "nonpayable",
            inputs: [
              { name: "spender", type: "address" },
              { name: "amount", type: "uint256" }
            ],
            outputs: [{ type: "bool" }]
          }
        ]
      } as const;

      console.log("Approving Token In...");
      await writeContractAsync({
        ...tokenAContract,
        functionName: "approve",
        args: [addresses.TradeEasyRouter as \`0x\${string}\`, parsedAmountIn]
      });

      // Swap
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

      alert(\`Swap completed successfully! Hash: \${tx}\`);
      setSwapAmountIn("");
    } catch (err: any) {
      console.error(err);
      alert(\`Swap failed: \${err.message || err}\`);
    } finally {
      setIsSwapping(false);
    }
  };`;

const newHandleSwap = `  const handleSwap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) return showToast("Please connect your wallet");
    if (!tokenA || !tokenB || !swapAmountIn) return showToast("Please fill all fields");

    setIsSwapping(true);
    try {
      const parsedAmountIn = parseEther(swapAmountIn);

      if (needsApproval) {
        // Approve router to spend tokenA
        const tokenAContract = {
          address: tokenA as \`0x\${string}\`,
          abi: [
            {
              name: "approve",
              type: "function",
              stateMutability: "nonpayable",
              inputs: [
                { name: "spender", type: "address" },
                { name: "amount", type: "uint256" }
              ],
              outputs: [{ type: "bool" }]
            }
          ]
        } as const;

        console.log("Approving Token In...");
        await writeContractAsync({
          ...tokenAContract,
          functionName: "approve",
          args: [addresses.TradeEasyRouter as \`0x\${string}\`, parsedAmountIn]
        });
        
        await refetchAllowance();
        showToast("Approval successful. You can now execute the swap.");
      } else {
        // Swap
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
  };`;

content = content.replace(oldHandleSwap, newHandleSwap);

// 4. Update the button rendering logic
const oldButton = `<button
                  type="submit"
                  disabled={isSwapping}
                  className="w-full py-4 bg-gradient-to-r from-neon-teal to-teal-800 hover:from-teal-500 hover:to-neon-teal text-white font-bold rounded-xl transition-all duration-200 mt-2 flex items-center justify-center gap-2 border border-teal-500/30"
                >
                  {isSwapping ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Swapping...
                    </>
                  ) : (
                    "Execute Swap"
                  )}
                </button>`;

const newButton = `<button
                  type="submit"
                  disabled={isSwapping}
                  className="w-full py-4 bg-gradient-to-r from-neon-teal to-teal-800 hover:from-teal-500 hover:to-neon-teal text-white font-bold rounded-xl transition-all duration-200 mt-2 flex items-center justify-center gap-2 border border-teal-500/30"
                >
                  {isSwapping ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {needsApproval ? "Approving..." : "Swapping..."}
                    </>
                  ) : needsApproval ? (
                    "Approve Token"
                  ) : (
                    "Execute Swap"
                  )}
                </button>`;

content = content.replace(oldButton, newButton);

// 5. Add Toast UI component at the bottom before </main>
const oldMainEnd = `    </main>
  );
}`;

const newMainEnd = `      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-[#1a1c23] border border-white/10 text-white px-6 py-4 rounded-xl shadow-2xl z-50 animate-fadeIn flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-neon-teal" />
          <p className="text-sm font-medium">{toastMessage}</p>
        </div>
      )}
    </main>
  );
}`;

content = content.replace(oldMainEnd, newMainEnd);

fs.writeFileSync(pagePath, content);
console.log("Successfully patched page.tsx!");
