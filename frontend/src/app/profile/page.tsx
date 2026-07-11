"use client";

import React from "react";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useBalance, useReadContract } from "wagmi";
import { formatEther, formatUnits } from "viem";
import { 
  Coins, 
  ArrowLeftRight, 
  Bot, 
  Sparkles, 
  User, 
  Wallet,
  ExternalLink,
  Activity,
  Layers
} from "lucide-react";

import addresses from "@/contracts/addresses.json";
import TokenCreatorAbi from "@/contracts/TokenCreator.json";

const ERC20_ABI = [
  {
    "inputs": [{ "name": "account", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

export default function Profile() {
  const { address: userAddress, isConnected } = useAccount();

  // Fetch Balances
  const { data: hbarBalance } = useBalance({ 
    address: userAddress,
    query: { enabled: !!userAddress, refetchInterval: 5000 }
  });

  const { data: teraBalance } = useReadContract({
    address: (addresses as any).TERA as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!userAddress, refetchInterval: 5000 }
  });

  const { data: usdcBalance } = useReadContract({
    address: (addresses as any).USDC as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!userAddress, refetchInterval: 5000 }
  });

  // Fetch Deployed Assets
  const { data: userTokens } = useReadContract({
    address: (addresses as any).TokenCreator as `0x${string}`,
    abi: TokenCreatorAbi,
    functionName: "getUserTokens",
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!userAddress }
  });

  const shortAddress = userAddress ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}` : "";
  const gradientStyle = userAddress ? {
    background: `linear-gradient(135deg, #${userAddress.slice(2, 8)}, #${userAddress.slice(8, 14)})`
  } : {
    background: `linear-gradient(135deg, #2D1B69, #0D9488)`
  };

  return (
    <main className="min-h-screen px-4 pb-20 pt-32 flex flex-col items-center relative overflow-hidden">
      {/* Glow effects */}
      <div className="ambient-glow-purple top-20 right-20 opacity-50"></div>
      <div className="ambient-glow-teal bottom-20 left-20 opacity-50"></div>

      {/* Levitating Nav Bar */}
      <nav className="levitating-nav">
        <div className="flex items-center gap-2 mr-4">
          <Sparkles className="w-5 h-5 text-neon-purple text-glow-purple" />
          <span className="font-bold tracking-tight text-white text-lg">TradeEasy</span>
        </div>
        <div className="flex gap-1 border-r border-white/10 pr-4 mr-2">
          <Link
            href="/"
            className="px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-1.5 text-gray-400 hover:text-white"
          >
            <Coins className="w-4 h-4" />
            Mint
          </Link>
          <Link
            href="/"
            className="px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-1.5 text-gray-400 hover:text-white"
          >
            <ArrowLeftRight className="w-4 h-4" />
            Swap
          </Link>
          <Link
            href="/"
            className="px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-1.5 text-gray-400 hover:text-white"
          >
            <Bot className="w-4 h-4" />
            AI Agent
          </Link>
          <Link
            href="/"
            className="px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-1.5 text-gray-400 hover:text-white"
          >
            <Coins className="w-4 h-4" />
            Faucet
          </Link>
          <div className="px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-1.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.3)]">
            <User className="w-4 h-4" />
            Profile
          </div>
        </div>
        <ConnectButton showBalance={false} chainStatus="none" accountStatus="avatar" />
      </nav>

      {/* Main Container */}
      <div className="w-full max-w-4xl z-10 flex flex-col gap-8 animate-fadeIn">
        
        {/* Identity Header */}
        <div className="glass-card p-8 relative overflow-hidden flex flex-col sm:flex-row items-center gap-6 border border-white/10">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent z-0 pointer-events-none"></div>
          
          <div 
            className="w-24 h-24 rounded-full border-4 border-[#0B0C10] shadow-[0_0_30px_rgba(45,212,191,0.3)] z-10 flex-shrink-0"
            style={gradientStyle}
          ></div>
          
          <div className="z-10 text-center sm:text-left flex-1">
            {isConnected ? (
              <>
                <h1 className="text-3xl font-bold text-white tracking-wide mb-1 text-glow-white">
                  Adesokan Timothy Olashile
                </h1>
                <div className="flex items-center justify-center sm:justify-start gap-2 text-gray-400 font-mono text-sm bg-black/30 px-3 py-1 w-fit mx-auto sm:mx-0 rounded-full border border-white/5">
                  <Wallet className="w-4 h-4 text-neon-teal" />
                  {shortAddress}
                </div>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-white mb-2">Connect Your Wallet</h1>
                <p className="text-gray-400 text-sm">Please connect your wallet to view your identity and assets.</p>
              </>
            )}
          </div>
        </div>

        {/* Wallet Balances Metric Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* HBAR Balance */}
          <div className="glass-card p-6 flex flex-col gap-4 border border-white/5 hover:border-white/10 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-400 uppercase tracking-wider">HBAR Balance</span>
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                <span className="font-bold text-white text-xs tracking-tighter">Ħ</span>
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white">
                {isConnected && hbarBalance ? Number(hbarBalance.formatted).toFixed(2) : "0.00"}
              </span>
              <span className="text-sm text-gray-500">HBAR</span>
            </div>
          </div>

          {/* $TERA Balance */}
          <div className="glass-card p-6 flex flex-col gap-4 border border-white/5 hover:border-neon-purple/30 transition-colors group relative overflow-hidden">
            <div className="absolute inset-0 bg-neon-purple/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="flex items-center justify-between relative z-10">
              <span className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Native Token</span>
              <div className="w-8 h-8 rounded-full bg-neon-purple/10 flex items-center justify-center border border-neon-purple/20">
                <Sparkles className="w-4 h-4 text-neon-purple" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 relative z-10">
              <span className="text-3xl font-bold text-white group-hover:text-glow-purple transition-shadow">
                {isConnected && teraBalance !== undefined ? Number(formatEther(teraBalance as bigint)).toFixed(2) : "0.00"}
              </span>
              <span className="text-sm text-neon-purple">$TERA</span>
            </div>
          </div>

          {/* USDC Balance */}
          <div className="glass-card p-6 flex flex-col gap-4 border border-white/5 hover:border-blue-500/30 transition-colors group relative overflow-hidden">
            <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="flex items-center justify-between relative z-10">
              <span className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Stablecoin</span>
              <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                <span className="font-bold text-blue-400 text-xs">$</span>
              </div>
            </div>
            <div className="flex items-baseline gap-2 relative z-10">
              <span className="text-3xl font-bold text-white group-hover:shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-shadow">
                {isConnected && usdcBalance !== undefined ? Number(formatUnits(usdcBalance as bigint, 6)).toFixed(2) : "0.00"}
              </span>
              <span className="text-sm text-blue-400">USDC</span>
            </div>
          </div>
        </div>

        {/* My Deployed Assets */}
        <div className="glass-card p-8 flex flex-col gap-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
              <Layers className="w-5 h-5 text-neon-teal" />
              My Deployed Assets
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-black/40 px-3 py-1 rounded-full border border-white/5">
              <Activity className="w-3 h-3 text-neon-purple" />
              Live Network State
            </div>
          </div>

          {isConnected ? (
            Array.isArray(userTokens) && userTokens.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(userTokens as string[]).map((tokenAddr, idx) => (
                  <div key={idx} className="bg-black/30 border border-white/5 rounded-xl p-4 flex items-center justify-between hover:bg-white/5 transition-colors group">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">HTS Token</span>
                      <span className="font-mono text-sm text-white group-hover:text-neon-teal transition-colors">
                        {tokenAddr}
                      </span>
                    </div>
                    <a 
                      href={`https://hashscan.io/testnet/token/${tokenAddr}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-neon-teal/20 hover:text-neon-teal transition-all border border-white/10 hover:border-neon-teal/30"
                      title="View on Hashscan"
                    >
                      <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-neon-teal transition-colors" />
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-2">
                  <Coins className="w-6 h-6 text-gray-500" />
                </div>
                <h3 className="text-lg font-medium text-white">No Assets Found</h3>
                <p className="text-sm text-gray-400 max-w-sm">You haven't deployed any HTS tokens using Trade Easy yet.</p>
                <Link href="/" className="mt-2 px-6 py-2 bg-neon-teal/20 text-neon-teal border border-neon-teal/30 rounded-full text-sm font-semibold hover:bg-neon-teal hover:text-black transition-all hover:shadow-[0_0_20px_rgba(45,212,191,0.4)]">
                  Mint Your First Token
                </Link>
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center py-10">
              <p className="text-sm text-gray-400">Connect your wallet to view deployed assets.</p>
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
