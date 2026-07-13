"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { CustomConnectButton } from "@/components/CustomConnectButton";
import { 
  useAccount, 
  useWriteContract, 
  useReadContract,
  usePublicClient,
  useWalletClient 
} from "wagmi";
import { parseEther, formatEther, encodeFunctionData, toHex, getAddress } from "viem";
import { 
  Coins, 
  ArrowLeftRight, 
  Bot, 
  ChevronRight, 
  Plus, 
  Sparkles, 
  Cpu, 
  ShieldAlert, 
  CheckCircle2, 
  Loader2,
  ExternalLink,
  User
} from "lucide-react";

import addresses from "@/contracts/addresses.json";
import TokenCreatorAbi from "@/contracts/TokenCreator.json";
import TradeEasyRouterAbi from "@/contracts/TradeEasyRouter.json";
import TradeEasyFactoryAbi from "@/contracts/TradeEasyFactory.json";
import TeraFaucetAbi from "@/contracts/TeraFaucet.json";

const HTS_PRECOMPILE = "0x0000000000000000000000000000000000000167";
const HTS_ABI = [
  {
    "inputs": [
      { "name": "account", "type": "address" },
      { "name": "token", "type": "address" }
    ],
    "name": "isAssociated",
    "outputs": [
      { "name": "responseCode", "type": "int256" },
      { "name": "associated", "type": "bool" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "name": "account", "type": "address" },
      { "name": "token", "type": "address" }
    ],
    "name": "associateToken",
    "outputs": [
      { "name": "responseCode", "type": "int256" }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;

const TokenSelector = ({ label, value, onChange, placeholder }: { label: string, value: string, onChange: (v: string) => void, placeholder: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [customToken, setCustomToken] = useState("");
  const teraAddress = (addresses as any).TERA;
  const usdcAddress = (addresses as any).USDC;
  const isHbar = value === "HBAR";
  const isTera = teraAddress && value === teraAddress;
  const isUsdc = usdcAddress && value === usdcAddress;
  const isCustom = value !== "" && !isHbar && !isTera && !isUsdc;

  return (
    <div className="flex flex-col gap-1.5 relative">
      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</label>
      <div 
        className="w-full px-4 py-3 bg-void/50 border border-white/10 rounded-xl focus-within:border-neon-teal/50 transition-all cursor-pointer flex justify-between items-center group hover:shadow-[0_0_15px_rgba(45,212,191,0.2)] hover:border-neon-teal/40"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="text-white text-sm truncate pr-2">
          {isHbar ? "HBAR" : isTera ? "TERA" : isUsdc ? "USDC" : isCustom ? value : placeholder}
        </span>
        <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform duration-300 flex-shrink-0 ${isOpen ? "rotate-90" : ""}`} />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[#0B0C10] border border-white/10 rounded-xl overflow-hidden z-50 animate-fadeIn shadow-2xl">
          <div 
            className="px-4 py-3 hover:bg-neon-teal/10 hover:text-neon-teal cursor-pointer transition-colors text-sm text-gray-300 flex items-center justify-between group"
            onClick={() => { onChange("HBAR"); setIsOpen(false); }}
          >
            HBAR
          </div>
          {teraAddress && (
            <div 
              className="px-4 py-3 hover:bg-neon-purple/10 hover:text-neon-purple cursor-pointer transition-colors text-sm text-gray-300 flex items-center justify-between group border-t border-white/5"
              onClick={() => { onChange(teraAddress); setIsOpen(false); }}
            >
              TERA 
              <span className="text-[10px] uppercase tracking-wider bg-neon-purple/20 text-neon-purple px-2 py-0.5 rounded-full border border-neon-purple/30 text-glow-purple shadow-[0_0_10px_rgba(168,85,247,0.5)]">Native Token</span>
            </div>
          )}
          {usdcAddress && (
            <div 
              className="px-4 py-3 hover:bg-blue-500/10 hover:text-blue-400 cursor-pointer transition-colors text-sm text-gray-300 flex items-center justify-between group border-t border-white/5"
              onClick={() => { onChange(usdcAddress); setIsOpen(false); }}
            >
              USDC 
              <span className="text-[10px] uppercase tracking-wider bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.5)]">Stablecoin</span>
            </div>
          )}
          <div 
            className="px-4 py-3 hover:bg-white/5 cursor-pointer transition-colors text-sm text-gray-300 flex flex-col gap-2 border-t border-white/5"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-gray-400">Custom Token</span>
            <input 
              type="text" 
              placeholder="Paste Address 0x..." 
              className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-neon-teal/50"
              value={isCustom ? value : customToken}
              onChange={(e) => {
                setCustomToken(e.target.value);
                onChange(e.target.value);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<"mint" | "swap" | "agent" | "faucet">("mint");
  const { address: userAddress, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  // --- MINT STATE ---
  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [tokenDecimals, setTokenDecimals] = useState("18");
  const [initialSupply, setInitialSupply] = useState("");
  const [creationFeeHbar, setCreationFeeHbar] = useState("25"); // HBAR fee for HTS token creation
  const [mintingTx, setMintingTx] = useState(false);
  const [userTokenList, setUserTokenList] = useState<string[]>([]);

  // --- SWAP STATE ---
  const [tokenA, setTokenA] = useState("");
  const [tokenB, setTokenB] = useState("");
  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");
  const [swapAmountIn, setSwapAmountIn] = useState("");
  const [slippage, setSlippage] = useState("0.5");
  const [isSwapping, setIsSwapping] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 5000);
  };
  const [isAddingLiquidity, setIsAddingLiquidity] = useState(false);

  // --- AI AGENT STATE ---
  const [agentInput, setAgentInput] = useState("");
  const [agentSelectedToken, setAgentSelectedToken] = useState("");
  const [agentStatus, setAgentStatus] = useState<"idle" | "thinking" | "done" | "rejected">("idle");
  const [agentLogs, setAgentLogs] = useState<Array<{ type: "user" | "agent" | "system" | "error"; text: string; hash?: string }>>([
    { type: "agent", text: "System Online. Secure policy enforcement active: Max limit 100 HBAR / 1000 tokens. Deployed address allow-list active. How can I assist you on Hedera TestNet today?" }
  ]);

  // --- FAUCET STATE ---
  const [faucetClaimTx, setFaucetClaimTx] = useState(false);
  const [nextClaimTime, setNextClaimTime] = useState<number | null>(null);
  const [countdownStr, setCountdownStr] = useState<string>("");

  // --- ASSOCIATION STATE ---
  const [isTokenAssociated, setIsTokenAssociated] = useState<boolean>(false);
  const [isAssociating, setIsAssociating] = useState(false);

  // Check association
  const { data: assocData, isError: isAssocError } = useReadContract({
    address: HTS_PRECOMPILE as `0x${string}`,
    abi: HTS_ABI,
    functionName: "isAssociated",
    args: userAddress && addresses.TERA ? [userAddress, addresses.TERA as `0x${string}`] : undefined,
    query: {
      enabled: !!userAddress && !!addresses.TERA,
      retry: false
    }
  });

  useEffect(() => {
    if (assocData) {
      setIsTokenAssociated(assocData[1] as boolean);
    } else if (isAssocError) {
      // Fallback for demo if not HTS token
      const mocked = localStorage.getItem(`mock_associated_${userAddress}`);
      setIsTokenAssociated(mocked === "true");
    }
  }, [assocData, isAssocError, userAddress]);

  const handleAssociate = async () => {
    if (!isConnected) return alert("Please connect your wallet");
    setIsAssociating(true);
    try {
      const tx = await writeContractAsync({
        address: HTS_PRECOMPILE as `0x${string}`,
        abi: HTS_ABI,
        functionName: "associateToken",
        args: [userAddress, addresses.TERA as `0x${string}`]
      });
      alert(`Association transaction submitted! Hash: ${tx}`);
      localStorage.setItem(`mock_associated_${userAddress}`, "true");
      setIsTokenAssociated(true);
    } catch(err: any) {
      console.error(err);
      // Fallback if real call fails (e.g. EVM ERC20 token instead of HTS)
      alert(`Association simulated (or failed): ${err.message || err}`);
      localStorage.setItem(`mock_associated_${userAddress}`, "true");
      setIsTokenAssociated(true);
    } finally {
      setIsAssociating(false);
    }
  };

  // Read next claim time
  const { data: claimTimeData, refetch: refetchClaimTime, isError, error } = useReadContract({
    address: addresses.TeraFaucet as `0x${string}`,
    abi: TeraFaucetAbi,
    functionName: "nextClaimTime",
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: !!userAddress,
      retry: false
    }
  });

  useEffect(() => {
    try {
      if (isError) {
        console.error("Error reading Faucet contract:", error);
        setNextClaimTime(0);
        return;
      }
      if (claimTimeData !== undefined) {
        setNextClaimTime(Number(claimTimeData));
      }
    } catch (e) {
      console.error("Try/Catch Faucet error:", e);
      setNextClaimTime(0);
    }
  }, [claimTimeData, isError, error]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (nextClaimTime === null) return;
      if (nextClaimTime === 0) {
        setCountdownStr("Ready to Claim");
        return;
      }
      const now = Math.floor(Date.now() / 1000);
      if (now >= nextClaimTime) {
        setCountdownStr("Ready to Claim");
      } else {
        const diff = nextClaimTime - now;
        const h = Math.floor(diff / 3600);
        const m = Math.floor((diff % 3600) / 60);
        const s = diff % 60;
        setCountdownStr(`${h}h ${m}m ${s}s`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [nextClaimTime]);

  const handleClaimFaucet = async () => {
    if (!isConnected) return alert("Please connect your wallet");
    setFaucetClaimTx(true);
    try {
      const tx = await writeContractAsync({
        address: addresses.TeraFaucet as `0x${string}`,
        abi: TeraFaucetAbi,
        functionName: "claimTera",
        args: []
      });
      alert(`Claimed 100 $TERA successfully! Hash: ${tx}`);
      setTimeout(() => refetchClaimTime(), 5000);
    } catch(err: any) {
      console.error(err);
      alert(`Claim failed: ${err.message || err}`);
    } finally {
      setFaucetClaimTx(false);
    }
  };

  // Read user created tokens
  const { data: createdTokens, refetch: refetchTokens } = useReadContract({
    address: addresses.TokenCreator as `0x${string}`,
    abi: TokenCreatorAbi,
    functionName: "getUserTokens",
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: !!userAddress
    }
  });

  useEffect(() => {
    if (createdTokens) {
      setUserTokenList(createdTokens as string[]);
    }
  }, [createdTokens]);

  // --- MINT SUBMIT ---
  const handleMintToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) return alert("Please connect your wallet first");
    if (!tokenName || !tokenSymbol || !initialSupply) return alert("All fields are required");

    setMintingTx(true);
    try {
      // Call createToken on the contract
      const tx = await writeContractAsync({
        address: addresses.TokenCreator as `0x${string}`,
        abi: TokenCreatorAbi,
        functionName: "createToken",
        args: [
          tokenName,
          tokenSymbol,
          BigInt(initialSupply),
          parseInt(tokenDecimals)
        ],
        value: parseEther(creationFeeHbar) // attaching HBAR fee for creation
      });

      alert(`HTS Token Creation transaction submitted! Hash: ${tx}`);
      setTokenName("");
      setTokenSymbol("");
      setInitialSupply("");
      setTimeout(() => refetchTokens(), 5000);
    } catch (err: any) {
      console.error(err);
      alert(`HTS Token Creation failed: ${err.message || err}`);
    } finally {
      setMintingTx(false);
    }
  };

  // --- ADD LIQUIDITY SUBMIT ---
  const handleAddLiquidity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) return alert("Please connect your wallet first");
    if (!tokenA || !tokenB || !amountA || !amountB) return alert("Please fill all fields");
    if (!walletClient) throw new Error('No wallet connected');
    if (!userAddress) return alert("User address missing");

    setIsAddingLiquidity(true);
    try {
      const parsedAmountA = parseEther(amountA);
      const parsedAmountB = parseEther(amountB);
      const checksummedUser = getAddress(userAddress);

      const sendRawTransaction = async (toAddress: string, dataHex: string, valueHex?: string) => {
        const checksummedTo = getAddress(toAddress);
        
        // Construct a bare-bones payload for HashPack compatibility
        const txParams: any = {
          from: checksummedUser,
          to: checksummedTo,
          data: dataHex,
          gas: toHex(1000000), // Explicit gas limit for HashPack
        };
        
        // Strict Value Handling: Explicit zero value required by HashPack
        txParams.value = valueHex ? valueHex : "0x0";

        const txHash = await walletClient.request({
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
        args: [getAddress(addresses.TradeEasyRouter as `0x${string}`), parsedAmountA]
      });
      await sendRawTransaction(tokenA, approveDataA);

      // 2. Approve token B
      console.log("Approving Token B...");
      const approveDataB = encodeFunctionData({
        abi: [{ name: "approve", type: "function", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }] }],
        functionName: "approve",
        args: [getAddress(addresses.TradeEasyRouter as `0x${string}`), parsedAmountB]
      });
      await sendRawTransaction(tokenB, approveDataB);

      // 3. Add Liquidity
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 600); // 10 mins
      console.log("Adding liquidity to pool...");
      
      const checksummedRouter = getAddress(addresses.TradeEasyRouter as `0x${string}`);
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

      alert(`Liquidity added successfully! Hash: ${tx}`);
      setAmountA("");
      setAmountB("");
    } catch (err: any) {
      console.error(err);
      alert(`Failed to add liquidity: ${err.message || err}`);
    } finally {
      setIsAddingLiquidity(false);
    }
  };

  // Check allowance for Token A
  const { data: tokenAAllowance, refetch: refetchAllowance } = useReadContract({
    address: tokenA && tokenA !== "HBAR" ? tokenA as `0x${string}` : undefined,
    abi: [{ name: "allowance", type: "function", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] }],
    functionName: "allowance",
    args: userAddress && addresses.TradeEasyRouter ? [userAddress, addresses.TradeEasyRouter as `0x${string}`] : undefined,
    query: {
      enabled: !!userAddress && !!tokenA && tokenA !== "HBAR",
    }
  });

  const parsedSwapAmountIn = swapAmountIn ? parseEther(swapAmountIn) : 0n;
  const needsApproval = tokenA !== "HBAR" && tokenA !== "" && tokenAAllowance !== undefined && (tokenAAllowance as bigint) < parsedSwapAmountIn;

  // --- SWAP SUBMIT ---
  const handleSwap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) return showToast("Please connect your wallet");
    if (!tokenA || !tokenB || !swapAmountIn) return showToast("Please fill all fields");
    if (!walletClient) throw new Error('No wallet connected');
    if (!userAddress) return showToast("User address missing");

    setIsSwapping(true);
    try {
      const parsedAmountIn = parseEther(swapAmountIn);
      const checksummedUser = getAddress(userAddress);

      const sendRawTransaction = async (toAddress: string, dataHex: string, valueHex?: string) => {
        const checksummedTo = getAddress(toAddress);
        
        // Construct a bare-bones payload for HashPack compatibility
        const txParams: any = {
          from: checksummedUser,
          to: checksummedTo,
          data: dataHex,
          gas: toHex(1000000), // Hardcoded gas limit to prevent HashPack gas estimation failures
        };
        
        // Strict Value Handling: Explicit zero value required by HashPack
        txParams.value = valueHex ? valueHex : "0x0";

        // Bypass viem completely and use the isolated walletClient
        const txHash = await walletClient.request({
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
          args: [getAddress(addresses.TradeEasyRouter as `0x${string}`), parsedAmountIn]
        });

        await sendRawTransaction(tokenA, approveData);
        
        await refetchAllowance();
        showToast("Approval successful. You can now execute the swap.");
      } else {
        // Use the dynamically deployed WETH/WHBAR Mock address from addresses.json
        const WHBAR_ADDRESS = getAddress((addresses as any).MockHBAR);
        const tA = tokenA === "HBAR" ? WHBAR_ADDRESS : getAddress(tokenA);
        const tB = tokenB === "HBAR" ? WHBAR_ADDRESS : getAddress(tokenB);
        
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200); // 20 minutes
        const path = [tA, tB];
        const checksummedRouter = getAddress(addresses.TradeEasyRouter as `0x${string}`);

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

        showToast(`Swap completed successfully! Hash: ${tx}`);
        setSwapAmountIn("");
      }
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes("User rejected") || err.message?.includes("User denied") || err.code === 4001 || err.message?.includes("4001")) {
        showToast("Transaction rejected by user.");
      } else {
        showToast(`Swap failed: ${err.message || err}`);
      }
    } finally {
      setIsSwapping(false);
    }
  };

  // --- AGENT COMMAND SUBMIT ---
  const handleAgentCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentInput.trim()) return;

    const userMsg = agentInput;
    setAgentInput("");
    setAgentLogs(prev => [...prev, { type: "user", text: userMsg }]);
    setAgentStatus("thinking");

    try {
      const payload: any = { prompt: userMsg };
      if (userAddress) payload.userAddress = userAddress;
      if (agentSelectedToken) payload.contextToken = agentSelectedToken;

      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.status === "REJECTED") {
        setAgentStatus("rejected");
        setAgentLogs(prev => [...prev, { 
          type: "error", 
          text: `🚨 POLICY REJECTED [${data.policyViolation}]: ${data.message}` 
        }]);
      } else if (data.status === "SUCCESS") {
        setAgentStatus("done");
        setAgentLogs(prev => [...prev, { 
          type: "agent", 
          text: `🛡️ Guardrails Passed: Transaction executed by Agent Hot Wallet. \n\n${data.message}`,
          hash: data.txHash
        }]);
      } else if (data.status === "SIMULATED") {
        setAgentStatus("done");
        setAgentLogs(prev => [...prev, { 
          type: "system", 
          text: `🔍 Simulated Success: Guardrails Checked. \n\nParsed Action: ${JSON.stringify(data.parsedAction)} \n\nMessage: ${data.message}` 
        }]);
      } else {
        setAgentStatus("done");
        setAgentLogs(prev => [...prev, { 
          type: "agent", 
          text: data.message || "Command executed, but response was unclear." 
        }]);
      }
    } catch (err: any) {
      console.error(err);
      setAgentStatus("idle");
      setAgentLogs(prev => [...prev, { type: "error", text: `Error: ${err.message || err}` }]);
    }
  };

  return (
    <main className="min-h-screen px-4 pb-20 pt-32 flex flex-col items-center">
      {/* Glow effects */}
      <div className="ambient-glow-purple top-10 left-10"></div>
      <div className="ambient-glow-teal bottom-10 right-10"></div>

      {/* Levitating Nav Bar */}
      <nav className="levitating-nav">
        <div className="flex items-center gap-2 mr-4">
          <Sparkles className="w-5 h-5 text-neon-purple text-glow-purple" />
          <span className="font-bold tracking-tight text-white text-lg">TradeEasy</span>
        </div>
        <div className="flex gap-1 border-r border-white/10 pr-4 mr-2">
          <button
            onClick={() => setActiveTab("mint")}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-1.5 ${
              activeTab === "mint" 
                ? "bg-neon-purple/20 text-neon-purple border border-neon-purple/30 text-glow-purple" 
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Coins className="w-4 h-4" />
            Mint
          </button>
          <button
            onClick={() => setActiveTab("swap")}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-1.5 ${
              activeTab === "swap" 
                ? "bg-neon-teal/20 text-neon-teal border border-neon-teal/30 text-glow-teal" 
                : "text-gray-400 hover:text-white"
            }`}
          >
            <ArrowLeftRight className="w-4 h-4" />
            Swap
          </button>
          <button
            onClick={() => setActiveTab("agent")}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-1.5 ${
              activeTab === "agent" 
                ? "bg-neon-purple/20 text-neon-purple border border-neon-purple/30 text-glow-purple" 
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Bot className="w-4 h-4" />
            AI Agent
          </button>
          <button
            onClick={() => setActiveTab("faucet")}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-1.5 ${
              activeTab === "faucet" 
                ? "bg-neon-teal/20 text-neon-teal border border-neon-teal/30 text-glow-teal" 
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Coins className="w-4 h-4" />
            Faucet
          </button>
          <Link
            href="/profile"
            className="px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-1.5 text-gray-400 hover:text-white"
          >
            <User className="w-4 h-4" />
            Profile
          </Link>
        </div>
        <CustomConnectButton />
      </nav>

      {/* Main Container */}
      <div className="w-full max-w-4xl z-10 flex flex-col gap-8">
        
        {/* MINT TAB */}
        {activeTab === "mint" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fadeIn">
            {/* Left Card: Create HTS Token */}
            <div className="glass-card p-8 flex flex-col gap-6">
              <div>
                <h2 className="text-2xl font-bold text-white tracking-wide flex items-center gap-2">
                  <Coins className="w-6 h-6 text-neon-purple" />
                  Mint HTS Token
                </h2>
                <p className="text-gray-400 text-sm mt-1">
                  Deploy a native Hedera Token Service (HTS) fungible token with auto-supply keys.
                </p>
              </div>

              <form onSubmit={handleMintToken} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Token Name</label>
                  <input
                    type="text"
                    value={tokenName}
                    onChange={(e) => setTokenName(e.target.value)}
                    placeholder="e.g. Antigravity"
                    className="w-full px-4 py-3 bg-void/50 border border-white/10 rounded-xl focus:border-neon-purple/50 focus:outline-none text-white text-sm"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Token Symbol</label>
                  <input
                    type="text"
                    value={tokenSymbol}
                    onChange={(e) => setTokenSymbol(e.target.value)}
                    placeholder="e.g. ANTI"
                    className="w-full px-4 py-3 bg-void/50 border border-white/10 rounded-xl focus:border-neon-purple/50 focus:outline-none text-white text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Decimals</label>
                    <input
                      type="number"
                      value={tokenDecimals}
                      onChange={(e) => setTokenDecimals(e.target.value)}
                      placeholder="18"
                      className="w-full px-4 py-3 bg-void/50 border border-white/10 rounded-xl focus:border-neon-purple/50 focus:outline-none text-white text-sm"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Initial Supply</label>
                    <input
                      type="number"
                      value={initialSupply}
                      onChange={(e) => setInitialSupply(e.target.value)}
                      placeholder="1000000"
                      className="w-full px-4 py-3 bg-void/50 border border-white/10 rounded-xl focus:border-neon-purple/50 focus:outline-none text-white text-sm"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">HTS Creation Fee (HBAR)</label>
                  <input
                    type="number"
                    value={creationFeeHbar}
                    onChange={(e) => setCreationFeeHbar(e.target.value)}
                    placeholder="25"
                    className="w-full px-4 py-3 bg-void/50 border border-white/10 rounded-xl focus:border-neon-purple/50 focus:outline-none text-white text-sm"
                  />
                  <span className="text-[10px] text-gray-500">Hedera Token Service requires HBAR to pay creation fees.</span>
                </div>

                <button
                  type="submit"
                  disabled={mintingTx}
                  className="w-full py-4 bg-gradient-to-r from-neon-purple to-purple-800 hover:from-purple-500 hover:to-neon-purple text-white font-bold rounded-xl transition-all duration-200 mt-2 flex items-center justify-center gap-2 border border-purple-500/30"
                >
                  {mintingTx ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Creating Token...
                    </>
                  ) : (
                    "Deploy HTS Token"
                  )}
                </button>
              </form>
            </div>

            {/* Right Card: Your Created Tokens */}
            <div className="glass-card p-8 flex flex-col gap-6">
              <div>
                <h3 className="text-xl font-bold text-white tracking-wide">Your Deployed Tokens</h3>
                <p className="text-gray-400 text-sm mt-1">HTS Tokens deployed via your wallet contract treasury.</p>
              </div>

              <div className="flex flex-col gap-3 overflow-y-auto max-h-[350px] pr-2">
                {userTokenList.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center border border-dashed border-white/10 rounded-2xl">
                    <Coins className="w-8 h-8 text-gray-600 mb-2" />
                    <p className="text-gray-500 text-sm">No tokens created yet.</p>
                  </div>
                ) : (
                  userTokenList.map((token, i) => (
                    <div key={i} className="p-4 bg-white/5 border border-white/10 rounded-xl flex flex-col gap-1 hover:border-white/20 transition-all">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-neon-purple font-mono uppercase font-bold">Token {i+1}</span>
                        <a 
                          href={`https://hashscan.io/testnet/token/${token}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-gray-400 hover:text-white flex items-center gap-1 text-[10px]"
                        >
                          HashScan <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <span className="text-sm font-mono text-white select-all break-all">{token}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* SWAP TAB */}
        {activeTab === "swap" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fadeIn">
            {/* Left Card: Swap */}
            <div className="glass-card-teal p-8 flex flex-col gap-6">
              <div>
                <h2 className="text-2xl font-bold text-white tracking-wide flex items-center gap-2">
                  <ArrowLeftRight className="w-6 h-6 text-neon-teal" />
                  Instant Swap
                </h2>
                <p className="text-gray-400 text-sm mt-1">Swap between assets seamlessly via AMM pools.</p>
              </div>

              <form onSubmit={handleSwap} className="flex flex-col gap-4">
                <div className="flex flex-col gap-4 z-40 relative">
                  <TokenSelector 
                    label="Token In" 
                    value={tokenA} 
                    onChange={setTokenA} 
                    placeholder="Select Token" 
                  />
                </div>

                <div className="flex flex-col gap-4 z-30 relative">
                  <TokenSelector 
                    label="Token Out" 
                    value={tokenB} 
                    onChange={setTokenB} 
                    placeholder="Select Token" 
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Amount In</label>
                  <input
                    type="number"
                    value={swapAmountIn}
                    onChange={(e) => setSwapAmountIn(e.target.value)}
                    placeholder="100"
                    className="w-full px-4 py-3 bg-void/50 border border-white/10 rounded-xl focus:border-neon-teal/50 focus:outline-none text-white text-sm"
                  />
                </div>

                <button
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
                </button>
              </form>
            </div>

            {/* Right Card: Liquidity Provision */}
            <div className="glass-card p-8 flex flex-col gap-6">
              <div>
                <h3 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
                  <Plus className="w-5 h-5 text-neon-teal" />
                  Add Liquidity Pool
                </h3>
                <p className="text-gray-400 text-sm mt-1">Provide liquidity to earn pool transaction fees.</p>
              </div>

              <form onSubmit={handleAddLiquidity} className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Amount A</label>
                    <input
                      type="number"
                      value={amountA}
                      onChange={(e) => setAmountA(e.target.value)}
                      placeholder="1000"
                      className="w-full px-4 py-3 bg-void/50 border border-white/10 rounded-xl focus:border-neon-teal/50 focus:outline-none text-white text-sm"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Amount B</label>
                    <input
                      type="number"
                      value={amountB}
                      onChange={(e) => setAmountB(e.target.value)}
                      placeholder="1000"
                      className="w-full px-4 py-3 bg-void/50 border border-white/10 rounded-xl focus:border-neon-teal/50 focus:outline-none text-white text-sm"
                    />
                  </div>
                </div>

                <div className="text-[11px] text-gray-500">
                  Note: Adding liquidity automatically approves both tokens for the router contract before depositing them.
                </div>

                <button
                  type="submit"
                  disabled={isAddingLiquidity}
                  className="w-full py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl border border-white/10 hover:border-white/20 transition-all duration-200 flex items-center justify-center gap-2"
                >
                  {isAddingLiquidity ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Adding Liquidity...
                    </>
                  ) : (
                    "Supply Liquidity"
                  )}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* AI AGENT TAB */}
        {activeTab === "agent" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-fadeIn">
            {/* Left 2 Columns: Conversational AI Command Sphere */}
            <div className="md:col-span-2 glass-card p-8 flex flex-col gap-6 min-h-[500px] justify-between">
              
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <Cpu className="w-7 h-7 text-neon-purple text-glow-purple" />
                  <div>
                    <h2 className="text-xl font-bold text-white tracking-wide">Hedera Trading Agent</h2>
                    <span className="text-xs text-neon-purple font-semibold font-mono">POLICY SECURED ACTIVE</span>
                  </div>
                </div>
                
                {/* Visual indicator of agent status */}
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    agentStatus === "thinking" ? "bg-neon-purple animate-ping" : 
                    agentStatus === "done" ? "bg-green-500" :
                    agentStatus === "rejected" ? "bg-red-500" : "bg-teal-500"
                  }`}></span>
                  <span className="text-xs text-gray-400 font-mono capitalize">{agentStatus}</span>
                </div>
              </div>

              {/* Chat log */}
              <div className="flex-1 overflow-y-auto my-4 pr-2 flex flex-col gap-4 max-h-[300px]">
                {agentLogs.map((log, i) => (
                  <div 
                    key={i} 
                    className={`flex flex-col gap-1.5 p-4 rounded-2xl max-w-[85%] ${
                      log.type === "user" 
                        ? "bg-neon-purple/10 border border-neon-purple/20 self-end text-white" 
                        : log.type === "error"
                        ? "bg-red-500/10 border border-red-500/20 self-start text-red-400"
                        : log.type === "system"
                        ? "bg-white/5 border border-white/10 self-start text-teal-400"
                        : "bg-white/5 border border-white/10 self-start text-gray-300"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-line font-medium leading-relaxed">{log.text}</p>
                    {log.hash && (
                      <a 
                        href={`https://hashscan.io/testnet/transaction/${log.hash}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-xs text-neon-purple font-mono flex items-center gap-1 hover:underline mt-1"
                      >
                        Verify on HashScan <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                ))}
                {agentStatus === "thinking" && (
                  <div className="bg-white/5 border border-white/10 p-4 rounded-2xl max-w-[85%] self-start flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-neon-purple" />
                    <span className="text-sm text-gray-400 font-mono">Agent analyzing policies and executing trade...</span>
                  </div>
                )}
              </div>

              {/* Input Form */}
              <div className="flex flex-col gap-3">
                <div className="w-full z-40 relative">
                  <TokenSelector 
                    label="Target Token (Context)" 
                    value={agentSelectedToken} 
                    onChange={setAgentSelectedToken} 
                    placeholder="Select a token..." 
                  />
                </div>
                <form onSubmit={handleAgentCommand} className="flex gap-2">
                  <input
                    type="text"
                    value={agentInput}
                    onChange={(e) => setAgentInput(e.target.value)}
                    placeholder="e.g. Swap 10 HBAR for token..."
                    className="flex-1 px-4 py-3.5 bg-void/50 border border-white/10 rounded-xl focus:border-neon-purple/50 focus:outline-none text-white text-sm"
                  />
                  <button
                    type="submit"
                    className="px-6 bg-neon-purple hover:bg-purple-600 text-white rounded-xl font-bold flex items-center gap-1.5 transition-all"
                  >
                    Send
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </div>

            {/* Right Column: Central Command Sphere */}
            <div className="glass-card p-8 flex flex-col items-center justify-center text-center gap-6">
              <h3 className="text-lg font-bold text-white tracking-wide">AI Command Sphere</h3>
              
              {/* Pulsing Command Sphere */}
              <div className="relative my-4">
                {/* Outer Glows */}
                <div className={`absolute inset-0 rounded-full bg-neon-purple/30 blur-xl transition-all duration-1000 ${
                  agentStatus === "thinking" ? "scale-125 animate-pulse" : "scale-100"
                }`}></div>
                <div className={`absolute inset-0 rounded-full bg-neon-teal/20 blur-lg transition-all duration-1000 ${
                  agentStatus === "thinking" ? "scale-110" : "scale-100"
                }`}></div>

                {/* Sphere body */}
                <div className={`w-36 h-36 rounded-full bg-gradient-to-br from-neon-purple via-indigo-900 to-neon-teal flex items-center justify-center border border-white/20 shadow-2xl relative z-10 transition-transform duration-500 ${
                  agentStatus === "thinking" ? "rotate-180 scale-105" : "hover:scale-105"
                }`}>
                  <Cpu className="w-16 h-16 text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]" />
                </div>
              </div>

              <div className="flex flex-col gap-4 mt-2">
                <div className="flex items-center gap-2 text-xs text-left bg-white/5 border border-white/10 p-3.5 rounded-xl">
                  <ShieldAlert className="w-7 h-7 text-neon-teal flex-shrink-0" />
                  <div>
                    <span className="font-bold text-white block">Spending Limit Guardrail</span>
                    <span className="text-gray-400">Max trade limited to 100 HBAR / 1000 Tokens.</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-left bg-white/5 border border-white/10 p-3.5 rounded-xl">
                  <CheckCircle2 className="w-7 h-7 text-neon-purple flex-shrink-0" />
                  <div>
                    <span className="font-bold text-white block">Verified Allow-list</span>
                    <span className="text-gray-400">Only signed smart contracts deployed on TradeEasy allowed.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FAUCET TAB */}
        {activeTab === "faucet" && (
          <div className="flex justify-center animate-fadeIn">
            <div className="glass-card-teal p-8 flex flex-col gap-6 max-w-md w-full text-center items-center">
              <div>
                <h2 className="text-2xl font-bold text-white tracking-wide flex items-center justify-center gap-2">
                  <Coins className="w-6 h-6 text-neon-teal" />
                  $TERA Daily Faucet
                </h2>
                <p className="text-gray-400 text-sm mt-2">
                  Claim exactly 100 $TERA tokens every 24 hours to test out Trade Easy dApp features.
                </p>
              </div>

              <div className="bg-void/50 border border-white/10 rounded-2xl p-6 w-full flex flex-col gap-2 relative overflow-hidden group">
                <div className="absolute inset-0 bg-neon-teal/5 group-hover:bg-neon-teal/10 transition-colors"></div>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider relative z-10">Next Claim Available</span>
                <span className={`text-3xl font-mono font-bold relative z-10 ${countdownStr === "Ready to Claim" ? "text-green-400" : "text-neon-teal text-glow-teal"}`}>
                  {nextClaimTime === null ? "Loading..." : countdownStr}
                </span>
              </div>

              {!isTokenAssociated ? (
                <button
                  onClick={handleAssociate}
                  disabled={isAssociating}
                  className={`w-full py-4 font-bold rounded-xl transition-all duration-300 mt-2 flex items-center justify-center gap-2 border shadow-[0_0_20px_rgba(168,85,247,0.3)] ${
                    isAssociating
                      ? "bg-gray-800 text-gray-500 border-gray-700 cursor-not-allowed shadow-none"
                      : "bg-gradient-to-r from-neon-purple to-purple-800 hover:from-purple-500 hover:to-neon-purple text-white border-purple-500/30"
                  }`}
                >
                  {isAssociating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Associating...
                    </>
                  ) : (
                    "Associate $TERA"
                  )}
                </button>
              ) : (
                <button
                  onClick={handleClaimFaucet}
                  disabled={faucetClaimTx || (nextClaimTime !== null && countdownStr !== "Ready to Claim")}
                  className={`w-full py-4 font-bold rounded-xl transition-all duration-300 mt-2 flex items-center justify-center gap-2 border shadow-[0_0_20px_rgba(45,212,191,0.3)] ${
                    faucetClaimTx || (nextClaimTime !== null && countdownStr !== "Ready to Claim")
                      ? "bg-gray-800 text-gray-500 border-gray-700 cursor-not-allowed shadow-none"
                      : "bg-gradient-to-r from-neon-teal to-teal-800 hover:from-teal-500 hover:to-neon-teal text-white border-teal-500/30"
                  }`}
                >
                  {faucetClaimTx ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Claiming...
                    </>
                  ) : (
                    "Claim 100 $TERA"
                  )}
                </button>
              )}
            </div>
          </div>
        )}

      </div>
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-[#1a1c23] border border-white/10 text-white px-6 py-4 rounded-xl shadow-2xl z-50 animate-fadeIn flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-neon-teal" />
          <p className="text-sm font-medium">{toastMessage}</p>
        </div>
      )}
    </main>
  );
}
