"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAccount, useBalance, useReadContract, useWriteContract } from "wagmi";
import { formatUnits } from "viem";
import {
  Coins,
  ArrowLeftRight,
  Bot,
  User,
  Wallet,
  ExternalLink,
  Activity,
  Layers,
  Droplets,
  Edit2,
  Check,
  X,
} from "lucide-react";

import { CustomConnectButton } from "@/components/CustomConnectButton";
import addresses from "@/contracts/addresses.json";
import TokenCreatorAbi from "@/contracts/TokenCreator.json";
import UserProfileAbi from "@/contracts/UserProfile.json";

const A = addresses as Record<string, string>;
const HORIZEN_CHAIN_ID = 845320009;
const EXPLORER = "https://horizen-explorer-testnet.appchain.base.org";

const ERC20_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export default function Profile() {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");

  const { data: ethBalance } = useBalance({ address, chainId: HORIZEN_CHAIN_ID });

  const { data: teraBalance } = useBalance({
    address,
    token: A.TERA as `0x${string}`,
    query: { enabled: !!address && !!A.TERA, refetchInterval: 5000 },
  });

  const { data: usdcBalance } = useReadContract({
    address: A.USDC as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!A.USDC, refetchInterval: 5000 },
  });

  const { data: userTokens } = useReadContract({
    address: A.TokenCreator as `0x${string}`,
    abi: TokenCreatorAbi,
    functionName: "getUserTokens",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!A.TokenCreator },
  });

  const { data: usernameData, refetch: refetchUsername } = useReadContract({
    address: A.UserProfile as `0x${string}`,
    abi: UserProfileAbi,
    functionName: "usernames",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!A.UserProfile, refetchInterval: 5000 },
  });

  const username = usernameData ? (usernameData as string) : "";
  const displayUsername = username || "Set your username";
  const shortAddress = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "";
  const avatarStyle = address
    ? { background: `linear-gradient(135deg, #${address.slice(2, 8)}, #${address.slice(8, 14)})` }
    : { background: "linear-gradient(135deg, #030e24, #fecb17)" };

  const handleSaveUsername = async () => {
    if (!editName.trim() || !A.UserProfile) return;
    try {
      await writeContractAsync({
        address: A.UserProfile as `0x${string}`,
        abi: UserProfileAbi,
        functionName: "setUsername",
        args: [editName],
      });
      setIsEditing(false);
      refetchUsername();
    } catch (err) {
      console.error("Error setting username:", err);
    }
  };

  return (
    <main className="min-h-screen px-4 pb-20 pt-28 flex flex-col items-center relative overflow-hidden">
      <div className="ambient-glow-purple top-0 -right-20" />
      <div className="ambient-glow-teal bottom-0 -left-20" />

      <nav className="levitating-nav">
        <div className="flex items-center gap-2 pl-2 pr-1">
          <span className="w-6 h-6 rounded-md bg-[var(--color-hz-navy)] flex items-center justify-center">
            <span className="w-2.5 h-2.5 rounded-[3px] bg-[var(--color-hz-gold)]" />
          </span>
          <span className="font-extrabold tracking-tight text-[var(--color-hz-navy)] text-[15px] hidden sm:block">Trade Easy</span>
        </div>
        <div className="flex gap-0.5 border-l border-r border-[var(--color-border)] px-2 mx-1">
          <NavLink href="/" icon={<ArrowLeftRight className="w-4 h-4" />} label="Swap" />
          <NavLink href="/" icon={<Bot className="w-4 h-4" />} label="AI Agent" />
          <NavLink href="/" icon={<Droplets className="w-4 h-4" />} label="Faucet" />
          <NavLink href="/" icon={<Coins className="w-4 h-4" />} label="Mint" />
          <span className="px-3.5 py-1.5 rounded-full text-sm font-medium flex items-center gap-1.5 bg-[var(--color-hz-gold)]/20 text-[var(--color-hz-navy)]">
            <User className="w-4 h-4" />
            <span className="hidden sm:inline">Profile</span>
          </span>
        </div>
        <CustomConnectButton />
      </nav>

      <div className="w-full max-w-4xl z-10 flex flex-col gap-8 animate-fadeIn">
        {/* Identity */}
        <div className="card p-8 flex flex-col sm:flex-row items-center gap-6">
          <div className="w-24 h-24 rounded-full border-4 border-white shadow-md flex-shrink-0" style={avatarStyle} />
          <div className="text-center sm:text-left flex-1">
            {isConnected ? (
              <>
                {isEditing ? (
                  <div className="flex items-center gap-2 mb-2 justify-center sm:justify-start">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Enter new username"
                      className="field max-w-xs"
                      autoFocus
                    />
                    <button onClick={handleSaveUsername} className="p-2 bg-[var(--color-hz-gold)]/20 text-[var(--color-hz-navy)] rounded-lg" title="Save">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => setIsEditing(false)} className="p-2 bg-[var(--color-hz-danger)]/10 text-[var(--color-hz-danger)] rounded-lg" title="Cancel">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <h1 className="text-3xl font-bold mb-1 flex items-center justify-center sm:justify-start gap-3 group">
                    {displayUsername}
                    <button
                      onClick={() => {
                        setEditName(username);
                        setIsEditing(true);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-[var(--color-surface-2)] rounded-full"
                      title="Edit username"
                    >
                      <Edit2 className="w-4 h-4 text-[var(--color-ink-3)]" />
                    </button>
                  </h1>
                )}
                <div className="flex items-center justify-center sm:justify-start gap-2 text-[var(--color-ink-2)] font-mono text-sm bg-[var(--color-surface-2)] px-3 py-1 w-fit mx-auto sm:mx-0 rounded-full border border-[var(--color-border)]">
                  <Wallet className="w-4 h-4 text-[var(--color-hz-gold-deep)]" />
                  {shortAddress}
                </div>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-bold mb-2">Connect Your Wallet</h1>
                <p className="text-[var(--color-ink-2)] text-sm">Connect your wallet to view your identity and assets.</p>
              </>
            )}
          </div>
        </div>

        {/* Balances */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <BalanceCard
            label="ETH Balance"
            value={ethBalance ? Number(ethBalance.formatted).toFixed(4) : "0.0000"}
            unit="ETH"
            badge="Gas token"
          />
          <BalanceCard
            label="Project Token"
            value={isConnected && teraBalance ? Number(teraBalance.formatted).toFixed(2) : "0.00"}
            unit="TERA"
            badge="TERA"
          />
          <BalanceCard
            label="Stablecoin"
            value={isConnected && usdcBalance !== undefined ? Number(formatUnits(usdcBalance as bigint, 6)).toFixed(2) : "0.00"}
            unit="USDC"
            badge="USDC"
          />
        </div>

        {/* Deployed assets */}
        <div className="card p-8 flex flex-col gap-6">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Layers className="w-5 h-5 text-[var(--color-hz-gold-deep)]" />
              My Deployed Assets
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-[var(--color-ink-2)] bg-[var(--color-surface-2)] px-3 py-1 rounded-full border border-[var(--color-border)]">
              <Activity className="w-3 h-3 text-[var(--color-hz-green)]" />
              Live network state
            </div>
          </div>

          {isConnected ? (
            Array.isArray(userTokens) && userTokens.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(userTokens as string[]).map((t, i) => (
                  <div key={i} className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl p-4 flex items-center justify-between">
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="text-xs text-[var(--color-ink-3)] uppercase tracking-wider font-semibold">Token</span>
                      <span className="font-mono text-sm truncate">{t}</span>
                    </div>
                    <a
                      href={`${EXPLORER}/token/${t}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-8 h-8 rounded-full bg-white flex items-center justify-center border border-[var(--color-border)] hover:border-[var(--color-hz-gold-deep)] transition-colors flex-shrink-0"
                      title="View on explorer"
                    >
                      <ExternalLink className="w-4 h-4 text-[var(--color-ink-2)]" />
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                <div className="w-16 h-16 rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-center mb-1">
                  <Coins className="w-6 h-6 text-[var(--color-ink-3)]" />
                </div>
                <h3 className="text-lg font-medium">No assets found</h3>
                <p className="text-sm text-[var(--color-ink-2)] max-w-sm">You haven&apos;t deployed any tokens with Trade Easy yet.</p>
                <Link href="/" className="btn-gold mt-2 px-6 py-2 text-sm rounded-full">
                  Deploy your first token
                </Link>
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center py-10">
              <p className="text-sm text-[var(--color-ink-2)]">Connect your wallet to view deployed assets.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function NavLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="px-3.5 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 text-[var(--color-ink-2)] hover:text-[var(--color-hz-navy)]"
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}

function BalanceCard({ label, value, unit, badge }: { label: string; value: string; unit: string; badge: string }) {
  return (
    <div className="card p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--color-ink-3)] uppercase tracking-wider">{label}</span>
        <span className="text-[10px] uppercase tracking-wider bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-ink-2)] px-2 py-0.5 rounded-full">
          {badge}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold">{value}</span>
        <span className="text-sm text-[var(--color-ink-3)]">{unit}</span>
      </div>
    </div>
  );
}
