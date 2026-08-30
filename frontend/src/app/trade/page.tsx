"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  useAccount,
  useWriteContract,
  useReadContract,
  useReadContracts,
  usePublicClient,
  useWalletClient,
  useSwitchChain,
} from "wagmi";
import { parseEther, erc20Abi, type Abi } from "viem";
import { ArrowLeftRight, Droplets, Loader2, ExternalLink, CheckCircle2, Vault, ChevronRight, User } from "lucide-react";

import { CustomConnectButton } from "@/components/CustomConnectButton";
import addresses from "@/contracts/addresses.json";
import TokenVendorAbi from "@/contracts/TokenVendor.json";
import TeraFaucetAbi from "@/contracts/TeraFaucet.json";

const HORIZEN_CHAIN_ID = 2651420;
const A = addresses as Record<string, string>;
const TESTNET_HUB_URL = "https://hub-testnet.horizen.io/";
const TESTNET_DOCS_URL = "https://horizen-2-docs.horizen.io/horizen-chain/network/testnet";
const NATIVE = "ETH";

type TabKey = "swap" | "faucet";

/* ------------------------------------------------------------------ */
/*  Token selector                                                     */
/* ------------------------------------------------------------------ */

function TokenSelector({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const tera = A.TERA;
  const usdc = A.USDC;
  const zen = A.ZEN;

  const isNative = value === NATIVE;
  const isTera = tera && value === tera;
  const isUsdc = usdc && value === usdc;
  const isZen = zen && value === zen;
  const isCustom = value !== "" && !isNative && !isTera && !isUsdc && !isZen;

  const shownLabel = isNative
    ? NATIVE
    : isTera
    ? "TERA"
    : isUsdc
    ? "USDC"
    : isZen
    ? "ZEN"
    : isCustom
    ? `${value.slice(0, 10)}…`
    : placeholder;

  const Row = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={onClick}
      className="w-full px-4 py-3 text-left text-sm text-[var(--color-ink)] hover:bg-[var(--color-surface-2)] flex items-center justify-between border-t border-[var(--color-border)] first:border-t-0 transition-colors"
    >
      {children}
    </button>
  );

  return (
    <div className="flex flex-col gap-1.5 relative">
      <label className="text-[11px] font-semibold text-[var(--color-ink-3)] uppercase tracking-wider">{label}</label>
      <button type="button" onClick={() => setOpen((o) => !o)} className="field flex justify-between items-center cursor-pointer">
        <span className="truncate pr-2">{shownLabel}</span>
        <ChevronRight className={`w-4 h-4 text-[var(--color-ink-3)] transition-transform ${open ? "rotate-90" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-[var(--color-border)] rounded-xl overflow-hidden z-50 animate-fadeIn shadow-xl">
          <Row onClick={() => { onChange(NATIVE); setOpen(false); }}>
            <span>{NATIVE}</span>
            <span className="text-[10px] uppercase tracking-wider bg-[var(--color-hz-navy)]/10 text-[var(--color-hz-navy)] px-2 py-0.5 rounded-full">Gas token</span>
          </Row>
          {tera && (
            <Row onClick={() => { onChange(tera); setOpen(false); }}>
              <span>TERA</span>
              <span className="text-[10px] uppercase tracking-wider bg-[var(--color-hz-gold)]/25 text-[var(--color-hz-gold-deep)] px-2 py-0.5 rounded-full">Project token</span>
            </Row>
          )}
          {usdc && (
            <Row onClick={() => { onChange(usdc); setOpen(false); }}>
              <span>USDC</span>
              <span className="text-[10px] uppercase tracking-wider bg-[var(--color-hz-blue)]/12 text-[var(--color-hz-blue)] px-2 py-0.5 rounded-full">Stablecoin</span>
            </Row>
          )}
          {zen && (
            <Row onClick={() => { onChange(zen); setOpen(false); }}>
              <span>ZEN</span>
              <span className="text-[10px] uppercase tracking-wider bg-[var(--color-hz-green)]/15 text-[var(--color-hz-green)] px-2 py-0.5 rounded-full">Horizen token</span>
            </Row>
          )}
          <div className="px-4 py-3 border-t border-[var(--color-border)] flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
            <span className="text-xs text-[var(--color-ink-3)]">Custom token</span>
            <input
              className="field text-xs"
              placeholder="Paste address 0x…"
              value={isCustom ? value : ""}
              onChange={(e) => onChange(e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Nav                                                                */
/* ------------------------------------------------------------------ */

function ZenPriceBadge() {
  const [p, setP] = useState<{ usd: number; chg: number | null } | null>(null);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=zencash&vs_currencies=usd&include_24hr_change=true"
        );
        const j = await r.json();
        if (alive && j?.zencash?.usd) setP({ usd: j.zencash.usd, chg: j.zencash.usd_24h_change ?? null });
      } catch {
        /* keep last value / stay hidden until first success */
      }
    };
    load();
    const i = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(i);
    };
  }, []);
  if (!p) return null;
  const up = (p.chg ?? 0) >= 0;
  return (
    <span
      title="ZEN market price (CoinGecko). The testnet tZEN token mirrors this asset."
      className="text-[11px] font-mono font-semibold text-[var(--color-ink-2)] bg-[var(--color-surface-2)] border border-[var(--color-border)] px-2.5 py-1 rounded-lg flex items-center gap-1.5"
    >
      ZEN&nbsp;${p.usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      {p.chg != null && (
        <span className={up ? "text-[var(--color-hz-green)]" : "text-[var(--color-hz-danger)]"}>
          {up ? "▲" : "▼"} {Math.abs(p.chg).toFixed(1)}%
        </span>
      )}
    </span>
  );
}

// TERA has no market — it is priced off the on-chain vendor rate, with the mock
// USDC pegged to $1:  1 ETH = tokensPerHbar TERA = usdcPerHbar USDC
//   => 1 TERA = (usdcPerHbar / tokensPerHbar) USDC = that many USD.
function TeraPriceBadge({ usd }: { usd: number }) {
  return (
    <span
      title="TERA value from the TokenVendor rate (mock USDC pegged to $1): 1 TERA = usdcPerHbar / tokensPerHbar USDC."
      className="text-[11px] font-mono font-semibold text-[var(--color-ink-2)] bg-[var(--color-surface-2)] border border-[var(--color-border)] px-2.5 py-1 rounded-lg"
    >
      TERA&nbsp;<span className="text-[var(--color-hz-gold-deep)]">${usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span>
    </span>
  );
}

function NavTab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${
        active ? "bg-[var(--color-hz-gold)]/20 text-[var(--color-hz-navy)]" : "text-[var(--color-ink-2)] hover:text-[var(--color-hz-navy)]"
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function TradePage() {
  const [tab, setTab] = useState<TabKey>("swap");
  const { address, isConnected, chainId } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [toast, setToast] = useState("");
  const showToast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 5000);
  };

  const ensureHorizen = async () => {
    if (chainId !== HORIZEN_CHAIN_ID) {
      await switchChainAsync({ chainId: HORIZEN_CHAIN_ID });
      await new Promise((r) => setTimeout(r, 1500));
    }
  };

  /* -------- Swap -------- */
  const [tokenA, setTokenA] = useState(NATIVE);
  const [tokenB, setTokenB] = useState("");
  const [swapAmountIn, setSwapAmountIn] = useState("");
  const [isSwapping, setIsSwapping] = useState(false);

  const handleSwap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) return showToast("Connect your wallet");
    if (!tokenA || !tokenB || !swapAmountIn) return showToast("Fill in every field");
    if (!walletClient || !address || !publicClient) return showToast("Wallet not ready");

    const vendor = A.TokenVendor;
    if (!vendor) return showToast("TokenVendor address missing from addresses.json");

    const ZERO = "0x0000000000000000000000000000000000000000" as const;
    const symOf = (t: string) =>
      t === NATIVE ? "ETH" : t === A.TERA ? "TERA" : t === A.USDC ? "USDC" : t === A.ZEN ? "ZEN" : "TOKEN";

    setIsSwapping(true);
    try {
      const amount = parseEther(swapAmountIn);
      await ensureHorizen();

      const abi = Array.isArray(TokenVendorAbi) ? TokenVendorAbi : (TokenVendorAbi as { abi: unknown[] }).abi;
      const tokenIn = (tokenA === NATIVE ? ZERO : tokenA) as `0x${string}`;
      const tokenOut = (tokenB === NATIVE ? ZERO : tokenB) as `0x${string}`;

      // --- balance pre-check (fail with a clear message instead of a reverted tx) ---
      if (tokenA === NATIVE) {
        const bal = await publicClient.getBalance({ address });
        if (bal < amount) throw new Error(`You have ${(Number(bal) / 1e18).toFixed(4)} ETH — need ${swapAmountIn}.`);
      } else {
        const sym = symOf(tokenA);
        const bal = (await publicClient.readContract({
          address: tokenIn,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [address],
        })) as bigint;
        if (bal < amount)
          throw new Error(`You have ${(Number(bal) / 1e18).toLocaleString()} ${sym} — need ${swapAmountIn}. Use "Get test ${sym}" first.`);

        // --- approve only if needed, and WAIT for it to confirm ---
        const allowance = (await publicClient.readContract({
          address: tokenIn,
          abi: erc20Abi,
          functionName: "allowance",
          args: [address, vendor as `0x${string}`],
        })) as bigint;
        if (allowance < amount) {
          const approveHash = await walletClient.writeContract({
            account: address as `0x${string}`,
            address: tokenIn,
            abi: erc20Abi,
            functionName: "approve",
            args: [vendor as `0x${string}`, amount],
          });
          await publicClient.waitForTransactionReceipt({ hash: approveHash });
        }
      }

      const txHash = await walletClient.writeContract({
        account: address as `0x${string}`,
        address: vendor as `0x${string}`,
        abi: abi as never,
        functionName: "swap" as never,
        args: [tokenIn, tokenOut, amount, 0n] as never,
        value: tokenA === NATIVE ? amount : 0n,
      });

      await publicClient.waitForTransactionReceipt({ hash: txHash });
      showToast(`Swap confirmed: ${txHash.slice(0, 12)}…`);
      setSwapAmountIn("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(
        /reject|denied|4001/i.test(msg)
          ? "Transaction rejected"
          : msg.length < 160
          ? msg
          : `Swap failed: ${msg.slice(0, 140)}…`
      );
    } finally {
      setIsSwapping(false);
    }
  };

  const mintTest = (which: "TERA" | "USDC" | "ZEN") => async () => {
    if (!isConnected || !walletClient || !address || !publicClient) return showToast("Connect your wallet");
    const tokenAddr = which === "TERA" ? A.TERA : which === "USDC" ? A.USDC : A.ZEN;
    if (!tokenAddr) return showToast(`${which} not deployed`);
    try {
      await ensureHorizen();
      const hash = await walletClient.writeContract({
        account: address as `0x${string}`,
        address: tokenAddr as `0x${string}`,
        abi: [
          { type: "function", name: "mint", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
        ],
        functionName: "mint",
        args: [address as `0x${string}`, parseEther("1000")],
      });
      showToast(`Minting 1,000 ${which}…`);
      await publicClient.waitForTransactionReceipt({ hash });
      showToast(`Got 1,000 ${which}`);
    } catch (err) {
      showToast(`Mint failed: ${err instanceof Error ? err.message.slice(0, 120) : String(err)}`);
    }
  };

  const symOfTok = (t: string) =>
    t === NATIVE ? "ETH" : t === A.TERA ? "TERA" : t === A.USDC ? "USDC" : t === A.ZEN ? "ZEN" : "TOKEN";
  const amountLabel = symOfTok(tokenA);

  /* -------- Vendor rate (source of truth for swap pricing) -------- */
  const { data: rateData } = useReadContracts({
    contracts: [{ address: A.TokenVendor as `0x${string}`, abi: TokenVendorAbi as Abi, functionName: "rate" }],
    query: { enabled: /^0x[a-fA-F0-9]{40}$/.test(A.TokenVendor || ""), refetchInterval: 60_000 },
  });
  const rate = Number((rateData?.[0]?.result as bigint | undefined) ?? 100n) || 100; // tokens per 1 ETH
  const teraUsd = 1; // every registered token is pegged 1:1 with the mock USDC ($1)

  // Fixed-rate model: ETH->token = rate, token->ETH = 1/rate, token<->token = 1
  const swapRate = (): { line: string; out: string } | null => {
    if (!tokenA || !tokenB || tokenA === tokenB) return null;
    const aIsEth = tokenA === NATIVE;
    const bIsEth = tokenB === NATIVE;
    const aSym = symOfTok(tokenA);
    const bSym = symOfTok(tokenB);
    if (aSym === "TOKEN" || bSym === "TOKEN") return null;
    const r = aIsEth ? rate : bIsEth ? 1 / rate : 1;
    const line = `1 ${aSym} ≈ ${r.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${bSym}`;
    const amt = parseFloat(swapAmountIn);
    const out = Number.isFinite(amt) && amt > 0 ? `≈ ${(amt * r).toLocaleString(undefined, { maximumFractionDigits: 6 })} ${bSym}` : "";
    return { line, out };
  };

  /* -------- Faucet -------- */
  const [faucetTx, setFaucetTx] = useState(false);
  const [nextClaimTime, setNextClaimTime] = useState<number | null>(null);
  const [countdown, setCountdown] = useState("");

  const { data: claimTimeData, refetch: refetchClaimTime, isError: claimErr } = useReadContract({
    address: A.TeraFaucet as `0x${string}`,
    abi: TeraFaucetAbi,
    functionName: "nextClaimTime",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!A.TeraFaucet, retry: false },
  });
  useEffect(() => {
    if (claimErr) setNextClaimTime(0);
    else if (claimTimeData !== undefined) setNextClaimTime(Number(claimTimeData));
  }, [claimTimeData, claimErr]);
  useEffect(() => {
    const i = setInterval(() => {
      if (nextClaimTime === null) return;
      const now = Math.floor(Date.now() / 1000);
      if (nextClaimTime === 0 || now >= nextClaimTime) return setCountdown("Ready to claim");
      const d = nextClaimTime - now;
      setCountdown(`${Math.floor(d / 3600)}h ${Math.floor((d % 3600) / 60)}m ${d % 60}s`);
    }, 1000);
    return () => clearInterval(i);
  }, [nextClaimTime]);

  const handleClaimFaucet = async () => {
    if (!isConnected) return showToast("Connect your wallet");
    if (!A.TeraFaucet) return showToast("Faucet not deployed on Horizen yet");
    setFaucetTx(true);
    try {
      await ensureHorizen();
      const tx = await writeContractAsync({
        address: A.TeraFaucet as `0x${string}`,
        abi: TeraFaucetAbi,
        functionName: "claimTera",
        args: [],
      });
      showToast(`Claimed 100 TERA: ${tx}`);
      setTimeout(() => refetchClaimTime(), 5000);
      addTeraToWallet();
    } catch (err) {
      showToast(`Claim failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setFaucetTx(false);
    }
  };

  // EIP-747: ask the wallet to track TERA so the claimed balance shows up.
  const addTeraToWallet = async () => {
    if (!A.TERA) return showToast("TERA not deployed on Horizen yet");
    const eth = (window as unknown as { ethereum?: { request: (a: unknown) => Promise<unknown> } }).ethereum;
    if (!eth) return showToast("No injected wallet found");
    try {
      await eth.request({
        method: "wallet_watchAsset",
        params: { type: "ERC20", options: { address: A.TERA, symbol: "TERA", decimals: 18 } },
      });
    } catch {
      /* user dismissed the prompt */
    }
  };

  /* ---------------------------------------------------------------- */

  return (
    <main className="min-h-screen px-4 pb-20 pt-28 flex flex-col items-center">
      <div className="ambient-glow-purple top-0 -left-20" />
      <div className="ambient-glow-teal bottom-0 -right-20" />

      <nav className="levitating-nav">
        <div className="flex items-center gap-2 pl-2 pr-1">
          <img src="/logo.svg" alt="Trade Easy" width={28} height={28} className="w-7 h-7" />
          <span className="font-extrabold tracking-tight text-[var(--color-hz-navy)] text-[15px] hidden sm:block">Trade Easy</span>
        </div>
        <div className="flex gap-0.5 border-l border-r border-[var(--color-border)] px-2 mx-1">
          <Link
            href="/vault"
            className="px-3.5 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 text-[var(--color-ink-2)] hover:text-[var(--color-hz-navy)]"
          >
            <Vault className="w-4 h-4" />
            <span className="hidden sm:inline">Vault</span>
          </Link>
          <NavTab active={tab === "swap"} onClick={() => setTab("swap")} icon={<ArrowLeftRight className="w-4 h-4" />} label="Swap" />
          <NavTab active={tab === "faucet"} onClick={() => setTab("faucet")} icon={<Droplets className="w-4 h-4" />} label="Faucet" />
          <Link
            href="/profile"
            className="px-3.5 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 text-[var(--color-ink-2)] hover:text-[var(--color-hz-navy)]"
          >
            <User className="w-4 h-4" />
            <span className="hidden sm:inline">Profile</span>
          </Link>
        </div>

        <div className="hidden md:flex items-center gap-2 border-r border-[var(--color-border)] pr-3 mr-1">
          <TeraPriceBadge usd={teraUsd} />
          <ZenPriceBadge />
        </div>

        <CustomConnectButton />
      </nav>

      <div className="w-full max-w-4xl z-10 flex flex-col gap-8">
        {tab === "swap" && (
          <div className="flex justify-center animate-fadeIn">
            <div className="card p-8 flex flex-col gap-6 max-w-md w-full">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <ArrowLeftRight className="w-6 h-6 text-[var(--color-hz-gold-deep)]" />
                  Instant Swap
                </h2>
                <p className="text-[var(--color-ink-2)] text-sm mt-1">
                  The venue the vault&apos;s agent trades against. Swap ETH, TERA, USDC and ZEN through the Token Vendor at a fixed rate.
                </p>
              </div>

              <form onSubmit={handleSwap} className="flex flex-col gap-4">
                <div className="z-40 relative">
                  <TokenSelector label="Token In" value={tokenA} onChange={setTokenA} placeholder="Select token" />
                </div>
                <div className="z-30 relative">
                  <TokenSelector label="Token Out" value={tokenB} onChange={setTokenB} placeholder="Select token" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-[var(--color-ink-3)] uppercase tracking-wider">
                      Amount in ({amountLabel})
                    </label>
                    <button
                      type="button"
                      onClick={() => setTab("faucet")}
                      className="text-[11px] font-semibold text-[var(--color-hz-blue)] hover:underline"
                    >
                      Need tokens?
                    </button>
                  </div>
                  <input type="number" value={swapAmountIn} onChange={(e) => setSwapAmountIn(e.target.value)} placeholder="1" className="field" />
                </div>

                {(() => {
                  const rate = swapRate();
                  if (!rate) return null;
                  return (
                    <div className="flex items-center justify-between text-xs bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2">
                      <span className="text-[var(--color-ink-3)]">Rate&nbsp;· {rate.line}</span>
                      {rate.out && <span className="font-mono font-semibold text-[var(--color-hz-navy)]">{rate.out}</span>}
                    </div>
                  );
                })()}

                <button type="submit" disabled={isSwapping} className="btn-gold w-full py-3.5 flex items-center justify-center gap-2">
                  {isSwapping && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSwapping ? "Swapping…" : "Execute Swap"}
                </button>
              </form>
            </div>
          </div>
        )}

        {tab === "faucet" && (
          <div className="flex justify-center animate-fadeIn">
            <div className="card p-8 flex flex-col gap-6 max-w-md w-full text-center items-center">
              <div>
                <h2 className="text-2xl font-bold flex items-center justify-center gap-2">
                  <Droplets className="w-6 h-6 text-[var(--color-hz-gold-deep)]" />
                  TERA Daily Faucet
                </h2>
                <p className="text-[var(--color-ink-2)] text-sm mt-2">Claim 100 TERA every 24 hours to test on Horizen.</p>
              </div>

              <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-2xl p-6 w-full flex flex-col gap-2">
                <span className="text-[11px] font-semibold text-[var(--color-ink-3)] uppercase tracking-wider">Next claim available</span>
                <span className={`text-3xl font-mono font-bold ${countdown === "Ready to claim" ? "text-[var(--color-hz-green)]" : "text-[var(--color-hz-navy)]"}`}>
                  {nextClaimTime === null ? "Loading…" : countdown}
                </span>
              </div>

              <button
                onClick={handleClaimFaucet}
                disabled={faucetTx || (nextClaimTime !== null && countdown !== "Ready to claim")}
                className="btn-gold w-full py-3.5 flex items-center justify-center gap-2"
              >
                {faucetTx && <Loader2 className="w-4 h-4 animate-spin" />}
                {faucetTx ? "Claiming…" : "Claim 100 TERA"}
              </button>

              <button
                onClick={addTeraToWallet}
                className="text-xs font-semibold text-[var(--color-hz-blue)] hover:underline flex items-center gap-1"
              >
                <Droplets className="w-3 h-3" /> Add TERA to your wallet
              </button>

              <div className="w-full border-t border-[var(--color-border)] pt-4 flex flex-col gap-2 text-left">
                <span className="text-[11px] font-semibold text-[var(--color-ink-3)] uppercase tracking-wider">
                  Mint test tokens · 1,000 each
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <button type="button" onClick={mintTest("TERA")} className="btn-ghost py-2 text-sm font-semibold">TERA</button>
                  <button type="button" onClick={mintTest("USDC")} className="btn-ghost py-2 text-sm font-semibold">USDC</button>
                  <button type="button" onClick={mintTest("ZEN")} className="btn-ghost py-2 text-sm font-semibold">ZEN</button>
                </div>
              </div>

              <div className="w-full border-t border-[var(--color-border)] pt-4 flex flex-col gap-2 text-left">
                <span className="text-[11px] font-semibold text-[var(--color-ink-3)] uppercase tracking-wider">Need gas? Horizen Testnet uses ETH</span>
                <a href={TESTNET_HUB_URL} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between text-sm text-[var(--color-hz-navy)] hover:text-[var(--color-hz-gold-deep)] transition-colors">
                  Bridge ETH via the Horizen hub <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <a href={TESTNET_DOCS_URL} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between text-sm text-[var(--color-hz-navy)] hover:text-[var(--color-hz-gold-deep)] transition-colors">
                  Add network &amp; RPC details <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-white border border-[var(--color-border)] px-5 py-3.5 rounded-xl shadow-xl z-50 animate-fadeIn flex items-center gap-3 max-w-sm">
          <CheckCircle2 className="w-5 h-5 text-[var(--color-hz-gold-deep)] flex-shrink-0" />
          <p className="text-sm break-all">{toast}</p>
        </div>
      )}
    </main>
  );
}
