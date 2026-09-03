"use client";

import React, { useState, useEffect } from "react";
import {
  useAccount,
  useBalance,
  useReadContracts,
  usePublicClient,
  useWalletClient,
  useSwitchChain,
} from "wagmi";
import { parseEther, erc20Abi, type Abi } from "viem";
import { ArrowLeftRight, ArrowUpDown, Loader2, ExternalLink, CheckCircle2, ChevronDown } from "lucide-react";

import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import addresses from "@/contracts/addresses.json";
import TokenVendorAbi from "@/contracts/TokenVendor.json";

const HORIZEN_CHAIN_ID = 2651420;
const A = addresses as Record<string, string>;
const TESTNET_HUB_URL = "https://hub-testnet.horizen.io/";
const TESTNET_DOCS_URL = "https://horizen-2-docs.horizen.io/horizen-chain/network/testnet";
const NATIVE = "ETH";
const ZERO = "0x0000000000000000000000000000000000000000" as const;

const symOf = (t: string) =>
  t === NATIVE ? "ETH" : t === A.USDC ? "USDC" : t === A.ZEN ? "ZEN" : t === A.TERA ? "TERA" : "TOKEN";

/* ------------------------------------------------------------------ */
/*  Token selector                                                     */
/* ------------------------------------------------------------------ */

function TokenSelector({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const usdc = A.USDC;
  const zen = A.ZEN;
  const tera = A.TERA;

  const isNative = value === NATIVE;
  const isUsdc = usdc && value === usdc;
  const isZen = zen && value === zen;
  const isTera = tera && value === tera;
  const isCustom = value !== "" && !isNative && !isUsdc && !isZen && !isTera;

  const shownLabel = isNative
    ? NATIVE
    : isUsdc
    ? "USDC"
    : isZen
    ? "ZEN"
    : isTera
    ? "TERA"
    : isCustom
    ? `${value.slice(0, 6)}…`
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
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-border-strong)] pl-3.5 pr-2.5 py-2 text-sm font-bold text-[var(--color-hz-navy)] hover:border-[var(--color-hz-gold-deep)] transition-colors whitespace-nowrap"
      >
        {shownLabel}
        <ChevronDown className={`w-4 h-4 text-[var(--color-ink-3)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-60 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden z-50 animate-fadeIn shadow-xl">
          <Row onClick={() => { onChange(NATIVE); setOpen(false); }}>
            <span>{NATIVE}</span>
            <span className="text-[10px] uppercase tracking-wider bg-[var(--color-hz-navy)]/10 text-[var(--color-hz-navy)] px-2 py-0.5 rounded-full">Gas token</span>
          </Row>
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
          {tera && (
            <Row onClick={() => { onChange(tera); setOpen(false); }}>
              <span>TERA</span>
              <span className="text-[10px] uppercase tracking-wider bg-[var(--color-hz-gold)]/25 text-[var(--color-hz-gold-deep)] px-2 py-0.5 rounded-full">Native token</span>
            </Row>
          )}
          <div className="px-4 py-3 border-t border-[var(--color-border)] flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
            <span className="text-xs text-[var(--color-ink-3)]">Custom token</span>
            <input className="field text-xs" placeholder="Paste address 0x…" value={isCustom ? value : ""} onChange={(e) => onChange(e.target.value)} />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * A swap panel — label, oversized figure, token pill, and a balance line
 * with optional 25/50/75/MAX quick-fills. Mirrors the vault's AmountField.
 */
function SwapField({
  label,
  amount,
  onAmountChange,
  readOnly,
  tokenNode,
  balance,
  onPercent,
}: {
  label: string;
  amount: string;
  onAmountChange?: (v: string) => void;
  readOnly?: boolean;
  tokenNode: React.ReactNode;
  balance?: string;
  onPercent?: (pct: number) => void;
}) {
  return (
    <div className="rounded-[14px] border border-[var(--color-border-strong)] bg-[var(--color-surface-2)] px-4 py-3.5 flex flex-col gap-2.5 focus-within:border-[var(--color-hz-gold-deep)] focus-within:shadow-[0_0_0_3px_rgba(254,203,23,0.22)] transition-shadow">
      <span className="text-[11px] font-semibold text-[var(--color-ink-3)] uppercase tracking-wider">{label}</span>
      <div className="flex items-center gap-3">
        <input
          value={amount}
          onChange={(e) => onAmountChange?.(e.target.value)}
          readOnly={readOnly}
          inputMode="decimal"
          placeholder="0.00"
          className="min-w-0 flex-1 bg-transparent border-0 p-0 outline-none text-[1.75rem] leading-none font-bold tabular-nums text-[var(--color-hz-navy)] placeholder:text-[var(--color-ink-3)] read-only:text-[var(--color-ink-2)]"
        />
        <div className="shrink-0">{tokenNode}</div>
      </div>
      <div className="flex items-center justify-between gap-2 min-h-[1.25rem]">
        <span className="text-xs text-[var(--color-ink-3)]">
          {balance != null && (
            <>
              Balance: <span className="tabular-nums text-[var(--color-ink-2)]">{balance}</span>
            </>
          )}
        </span>
        {onPercent && (
          <div className="flex items-center gap-0.5">
            {[25, 50, 75, 100].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onPercent(p)}
                className="px-1.5 py-0.5 rounded-md text-[11px] font-semibold text-[var(--color-hz-blue)] hover:bg-[var(--color-surface)] transition-colors"
              >
                {p === 100 ? "MAX" : `${p}%`}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ZenPriceBadge() {
  const [p, setP] = useState<{ usd: number; chg: number | null } | null>(null);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=zencash&vs_currencies=usd&include_24hr_change=true");
        const j = await r.json();
        if (alive && j?.zencash?.usd) setP({ usd: j.zencash.usd, chg: j.zencash.usd_24h_change ?? null });
      } catch {
        /* stay hidden until first success */
      }
    };
    load();
    const i = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(i); };
  }, []);
  if (!p) return null;
  const up = (p.chg ?? 0) >= 0;
  return (
    <span
      title="ZEN market price (CoinGecko). The testnet ZEN mock mirrors this asset."
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

// TERA has no market — every token the vendor lists is pegged 1:1 with the mock
// USDC ($1), so 1 TERA = 1 USDC = $1.00.
function TeraPriceBadge() {
  return (
    <span
      title="TERA value from the fixed-rate vendor: every listed token is pegged 1:1 with the mock USDC ($1)."
      className="text-[11px] font-mono font-semibold text-[var(--color-ink-2)] bg-[var(--color-surface-2)] border border-[var(--color-border)] px-2.5 py-1 rounded-lg"
    >
      TERA&nbsp;<span className="text-[var(--color-hz-gold-deep)]">$1.00</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

const isErcAddr = (t: string) => t !== NATIVE && /^0x[a-fA-F0-9]{40}$/.test(t);

/** Live balance for a token (native or ERC-20). All venue tokens are 18-dp. */
function useTokenBalance(token: string, address?: `0x${string}`) {
  const native = useBalance({
    address,
    query: { enabled: token === NATIVE && !!address, refetchInterval: 15_000 },
  });
  const erc = useReadContracts({
    contracts: isErcAddr(token)
      ? [{ address: token as `0x${string}`, abi: erc20Abi, functionName: "balanceOf", args: [address ?? ZERO] }]
      : [],
    query: { enabled: isErcAddr(token) && !!address, refetchInterval: 15_000 },
  });
  if (token === NATIVE) return native.data ? Number(native.data.value) / 1e18 : undefined;
  if (isErcAddr(token)) {
    const v = erc.data?.[0]?.result as bigint | undefined;
    return v != null ? Number(v) / 1e18 : undefined;
  }
  return undefined;
}

export default function TradePage() {
  const { address, isConnected, chainId } = useAccount();
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

  const [tokenA, setTokenA] = useState(NATIVE);
  const [tokenB, setTokenB] = useState("");
  const [swapAmountIn, setSwapAmountIn] = useState("");
  const [isSwapping, setIsSwapping] = useState(false);

  const abi = Array.isArray(TokenVendorAbi) ? TokenVendorAbi : (TokenVendorAbi as { abi: unknown[] }).abi;

  const handleSwap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) return showToast("Connect your wallet");
    if (!tokenA || !tokenB || !swapAmountIn) return showToast("Fill in every field");
    if (!walletClient || !address || !publicClient) return showToast("Wallet not ready");
    const vendor = A.TokenVendor;
    if (!vendor) return showToast("TokenVendor address missing from addresses.json");

    setIsSwapping(true);
    try {
      const amount = parseEther(swapAmountIn);
      await ensureHorizen();
      const tokenIn = (tokenA === NATIVE ? ZERO : tokenA) as `0x${string}`;
      const tokenOut = (tokenB === NATIVE ? ZERO : tokenB) as `0x${string}`;

      if (tokenA === NATIVE) {
        const bal = await publicClient.getBalance({ address });
        if (bal < amount) throw new Error(`You have ${(Number(bal) / 1e18).toFixed(4)} ETH — need ${swapAmountIn}.`);
      } else {
        const sym = symOf(tokenA);
        const bal = (await publicClient.readContract({ address: tokenIn, abi: erc20Abi, functionName: "balanceOf", args: [address] })) as bigint;
        if (bal < amount)
          throw new Error(`You have ${(Number(bal) / 1e18).toLocaleString()} ${sym} — need ${swapAmountIn}. Use "Get test ${sym}" first.`);
        const allowance = (await publicClient.readContract({ address: tokenIn, abi: erc20Abi, functionName: "allowance", args: [address, vendor as `0x${string}`] })) as bigint;
        if (allowance < amount) {
          const approveHash = await walletClient.writeContract({
            account: address as `0x${string}`, address: tokenIn, abi: erc20Abi, functionName: "approve", args: [vendor as `0x${string}`, amount],
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
      showToast(/reject|denied|4001/i.test(msg) ? "Transaction rejected" : msg.length < 160 ? msg : `Swap failed: ${msg.slice(0, 140)}…`);
    } finally {
      setIsSwapping(false);
    }
  };

  const mintTest = (which: "USDC" | "ZEN" | "TERA") => async () => {
    if (!isConnected || !walletClient || !address || !publicClient) return showToast("Connect your wallet");
    const tokenAddr = which === "USDC" ? A.USDC : which === "ZEN" ? A.ZEN : A.TERA;
    if (!tokenAddr) return showToast(`${which} not deployed`);
    try {
      await ensureHorizen();
      const hash = await walletClient.writeContract({
        account: address as `0x${string}`,
        address: tokenAddr as `0x${string}`,
        abi: [{ type: "function", name: "mint", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] }],
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

  const { data: rateData } = useReadContracts({
    contracts: [{ address: A.TokenVendor as `0x${string}`, abi: TokenVendorAbi as Abi, functionName: "rate" }],
    query: { enabled: /^0x[a-fA-F0-9]{40}$/.test(A.TokenVendor || ""), refetchInterval: 60_000 },
  });
  const rate = Number((rateData?.[0]?.result as bigint | undefined) ?? 100n) || 100;

  const balA = useTokenBalance(tokenA, address as `0x${string}` | undefined);
  const balB = useTokenBalance(tokenB, address as `0x${string}` | undefined);
  const fmtBal = (n?: number) =>
    n == null ? undefined : n.toLocaleString(undefined, { maximumFractionDigits: 4 });

  // fixed-rate leg conversion: 1 ETH = `rate` tokens, token↔token is 1:1
  const legRate = tokenA && tokenB && tokenA !== tokenB
    ? tokenA === NATIVE ? rate : tokenB === NATIVE ? 1 / rate : 1
    : null;
  const rateLine =
    legRate != null && symOf(tokenA) !== "TOKEN" && symOf(tokenB) !== "TOKEN"
      ? `1 ${symOf(tokenA)} ≈ ${legRate.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${symOf(tokenB)}`
      : "";
  const amtIn = parseFloat(swapAmountIn);
  const estOut =
    legRate != null && Number.isFinite(amtIn) && amtIn > 0
      ? (amtIn * legRate).toLocaleString(undefined, { maximumFractionDigits: 6 })
      : "";

  const flip = () => {
    setTokenA(tokenB || NATIVE);
    setTokenB(tokenA);
    setSwapAmountIn("");
  };

  const setPercent = (p: number) => {
    if (balA == null) return;
    const raw = tokenA === NATIVE && p === 100 ? Math.max(0, balA - 0.001) : (balA * p) / 100;
    setSwapAmountIn(raw ? String(Number(raw.toFixed(6))) : "0");
  };

  return (
    <main className="min-h-screen px-4 pb-20 pt-28 flex flex-col items-center">
      <div className="ambient-glow-purple top-0 -left-20" />
      <div className="ambient-glow-teal bottom-0 -right-20" />

      <SiteNav>
        <TeraPriceBadge />
        <ZenPriceBadge />
      </SiteNav>

      <div className="w-full max-w-md z-10">
        <div className="card card-raised p-6 sm:p-7 flex flex-col gap-6">
          <div>
            <h1 className="font-display text-[1.7rem] leading-[1.12] font-bold tracking-[-0.015em] text-[var(--color-hz-navy)] flex items-center gap-2.5">
              <ArrowLeftRight className="w-6 h-6 text-[var(--color-hz-gold-deep)] shrink-0" />
              Trading Venue
            </h1>
            <p className="text-[var(--color-ink-2)] text-sm mt-1.5">
              <span className="align-[0.09em] mr-2 text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-ink-3)] whitespace-nowrap">
                Mock venue
              </span>
              A fixed-rate stand-in for the venue the vault&apos;s agent swaps against &mdash; M2 routes to the Horizen private DEX. ETH · TERA · USDC · ZEN at 1 ETH = {rate} tokens.
            </p>
          </div>

          <form onSubmit={handleSwap} className="relative flex flex-col gap-2">
            <div className="relative">
              <SwapField
                label="You pay"
                amount={swapAmountIn}
                onAmountChange={setSwapAmountIn}
                tokenNode={<TokenSelector value={tokenA} onChange={setTokenA} placeholder="Select" />}
                balance={fmtBal(balA)}
                onPercent={balA != null ? setPercent : undefined}
              />
            </div>

            <div className="relative flex justify-center h-0 z-10">
              <button
                type="button"
                onClick={flip}
                aria-label="Swap direction"
                className="absolute -top-3 w-8 h-8 rounded-full bg-[var(--color-surface)] border border-[var(--color-border-strong)] flex items-center justify-center text-[var(--color-hz-navy)] hover:bg-[var(--color-surface-2)] hover:border-[var(--color-hz-gold-deep)] shadow-sm transition-colors"
              >
                <ArrowUpDown className="w-4 h-4" />
              </button>
            </div>

            <div className="relative">
              <SwapField
                label="You receive"
                amount={estOut}
                readOnly
                tokenNode={<TokenSelector value={tokenB} onChange={setTokenB} placeholder="Select" />}
                balance={fmtBal(balB)}
              />
            </div>

            <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--color-ink-3)] px-1 pt-1">
              <span className="tabular-nums">{rateLine}</span>
              <span>
                Get test{" "}
                <button type="button" onClick={mintTest("TERA")} className="font-semibold text-[var(--color-hz-blue)] hover:underline">TERA</button>
                {" · "}
                <button type="button" onClick={mintTest("USDC")} className="font-semibold text-[var(--color-hz-blue)] hover:underline">USDC</button>
                {" · "}
                <button type="button" onClick={mintTest("ZEN")} className="font-semibold text-[var(--color-hz-blue)] hover:underline">ZEN</button>
              </span>
            </div>

            <button type="submit" disabled={isSwapping} className="btn-gold w-full py-3.5 flex items-center justify-center gap-2 mt-2">
              {isSwapping && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSwapping ? "Swapping…" : "Execute Swap"}
            </button>
          </form>

          <div className="border-t border-[var(--color-border)] pt-4 flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-[var(--color-ink-3)] uppercase tracking-wider mb-1">Need gas? Horizen Testnet uses ETH</span>
            <a href={TESTNET_HUB_URL} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between text-sm text-[var(--color-ink-2)] hover:text-[var(--color-hz-navy)] hover:bg-[var(--color-surface-2)] -mx-2 px-2 py-2 rounded-lg transition-colors">
              Bridge ETH via the Horizen hub <ExternalLink className="w-3.5 h-3.5 text-[var(--color-ink-3)]" />
            </a>
            <a href={TESTNET_DOCS_URL} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between text-sm text-[var(--color-ink-2)] hover:text-[var(--color-hz-navy)] hover:bg-[var(--color-surface-2)] -mx-2 px-2 py-2 rounded-lg transition-colors">
              Add network &amp; RPC details <ExternalLink className="w-3.5 h-3.5 text-[var(--color-ink-3)]" />
            </a>
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-white border border-[var(--color-border)] px-5 py-3.5 rounded-xl shadow-xl z-50 animate-fadeIn flex items-center gap-3 max-w-sm">
          <CheckCircle2 className="w-5 h-5 text-[var(--color-hz-gold-deep)] flex-shrink-0" />
          <p className="text-sm break-all">{toast}</p>
        </div>
      )}

      <SiteFooter />
    </main>
  );
}
