"use client";

import React, { useMemo, useState } from "react";
import { useAccount, useReadContracts, useWriteContract } from "wagmi";
import { formatUnits, parseUnits, type Abi } from "viem";
import {
  Vault,
  ShieldCheck,
  Cpu,
  Loader2,
  ExternalLink,
  ArrowDownToLine,
  ArrowUpFromLine,
  Activity,
  AlertTriangle,
  Send,
  Landmark,
  Droplets,
} from "lucide-react";

import { SiteNav } from "@/components/SiteNav";
import addresses from "@/contracts/addresses.json";
import VaultAbiJson from "@/contracts/PrivateTradingVault.json";
import RegistryAbiJson from "@/contracts/AgentRegistry.json";

const VAULT_ABI = VaultAbiJson as Abi;
const REGISTRY_ABI = RegistryAbiJson as Abi;
const A = addresses as Record<string, string>;
const EXPLORER = "https://explorer-testnet.horizen.io";

const ERC20_ABI = [
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "o", type: "address" }, { name: "s", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "s", type: "address" }, { name: "a", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "mint", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
] as const satisfies Abi;

const VAULT = A.PrivateTradingVault as `0x${string}`;
const REGISTRY = A.AgentRegistry as `0x${string}`;

const isAddr = (x?: string): x is `0x${string}` => !!x && /^0x[a-fA-F0-9]{40}$/.test(x);
const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—");
const fmt = (v: bigint | undefined, d = 18, p = 4) =>
  v === undefined ? "—" : Number(formatUnits(v, d)).toLocaleString(undefined, { maximumFractionDigits: p });
const bps = (v: bigint | undefined) => (v === undefined ? "—" : `${Number(v) / 100}%`);
const secs = (v: bigint | undefined) => {
  if (v === undefined) return "—";
  const s = Number(v);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
};

/* ------------------------------------------------------------------ */

export default function VaultPage() {
  const [view, setView] = useState<"deposit" | "manager">("deposit");
  const deployed = isAddr(VAULT);

  return (
    <main className="min-h-screen px-4 pb-20 pt-28 flex flex-col items-center">
      <div className="ambient-glow-purple top-0 -left-20" />
      <div className="ambient-glow-teal bottom-0 -right-20" />

      <SiteNav />

      <div className="w-full max-w-5xl z-10">
        {!deployed ? (
          <NotDeployed />
        ) : (
          <>
            <div className="flex gap-2 mb-6 animate-fadeIn">
              <button
                onClick={() => setView("deposit")}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                  view === "deposit" ? "btn-gold" : "btn-ghost"
                }`}
              >
                Deposit
              </button>
              <button
                onClick={() => setView("manager")}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                  view === "manager" ? "btn-gold" : "btn-ghost"
                }`}
              >
                Manager
              </button>
            </div>
            {view === "deposit" ? <DepositorView /> : <ManagerView />}
          </>
        )}
      </div>
    </main>
  );
}

function NotDeployed() {
  return (
    <div className="card p-10 text-center animate-fadeIn">
      <Landmark className="w-10 h-10 text-[var(--color-ink-3)] mx-auto mb-3" />
      <h2 className="text-xl font-bold">Vault not deployed</h2>
      <p className="text-[var(--color-ink-2)] text-sm mt-2">
        Deploy the stack, then reload:&nbsp;
        <code className="text-[var(--color-hz-gold-deep)]">cd contracts &amp;&amp; npm run deploy:vault</code>
      </p>
      <p className="text-[var(--color-ink-3)] text-xs mt-3">
        The script merges vault addresses into <code>frontend/src/contracts/addresses.json</code>.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared reads                                                       */
/* ------------------------------------------------------------------ */

function useVaultData(user?: `0x${string}`) {
  const vaultCalls = [
    "totalAssets", "pricePerShare", "totalSupply", "asset", "paused", "emergency",
    "unwindOnly", "depositCap", "maxTradeBps", "maxDeployedBps", "maxDrawdownBps",
    "highWaterPricePerShare", "deployedValue", "heldTokens", "redeemRequestCount",
  ].map((functionName) => ({ address: VAULT, abi: VAULT_ABI, functionName }));

  const { data, refetch, isLoading } = useReadContracts({
    contracts: vaultCalls as never[],
    query: { refetchInterval: 12_000 },
  });
  const v = (i: number) => data?.[i]?.result as bigint | undefined;
  const asset = data?.[3]?.result as `0x${string}` | undefined;

  const userCalls =
    user && asset
      ? [
          { address: VAULT, abi: VAULT_ABI, functionName: "balanceOf", args: [user] },
          { address: asset, abi: ERC20_ABI, functionName: "balanceOf", args: [user] },
          { address: asset, abi: ERC20_ABI, functionName: "allowance", args: [user, VAULT] },
          { address: asset, abi: ERC20_ABI, functionName: "symbol" },
          { address: asset, abi: ERC20_ABI, functionName: "decimals" },
          { address: asset, abi: ERC20_ABI, functionName: "balanceOf", args: [VAULT] },
        ]
      : [];
  const { data: udata, refetch: refetchUser } = useReadContracts({
    contracts: userCalls as never[],
    query: { enabled: userCalls.length > 0, refetchInterval: 12_000 },
  });

  return {
    isLoading,
    refetch: () => { refetch(); refetchUser(); },
    totalAssets: v(0),
    pricePerShare: v(1),
    totalSupply: v(2),
    asset,
    paused: data?.[4]?.result as boolean | undefined,
    emergency: data?.[5]?.result as boolean | undefined,
    unwindOnly: data?.[6]?.result as boolean | undefined,
    depositCap: v(7),
    maxTradeBps: v(8),
    maxDeployedBps: v(9),
    maxDrawdownBps: v(10),
    highWater: v(11),
    deployedValue: v(12),
    heldTokens: (data?.[13]?.result as `0x${string}`[] | undefined) ?? [],
    requestCount: v(14),
    userShares: udata?.[0]?.result as bigint | undefined,
    userAssetBal: udata?.[1]?.result as bigint | undefined,
    allowance: udata?.[2]?.result as bigint | undefined,
    assetSymbol: (udata?.[3]?.result as string | undefined) ?? "asset",
    assetDecimals: Number((udata?.[4]?.result as number | undefined) ?? 18),
    idleLiquidity: udata?.[5]?.result as bigint | undefined,
  };
}

function useRedeemRequests(count?: bigint) {
  const n = Math.min(Number(count ?? 0n), 100);
  const calls = Array.from({ length: n }, (_, i) => ({
    address: VAULT, abi: VAULT_ABI, functionName: "redeemRequests", args: [BigInt(i)],
  }));
  const { data, refetch } = useReadContracts({
    contracts: calls as never[],
    query: { enabled: n > 0, refetchInterval: 12_000 },
  });
  const rows = (data ?? [])
    .map((r, i) => {
      const t = r.result as [string, bigint, bigint, bigint, boolean, boolean] | undefined;
      return t ? { id: i, owner: t[0], shares: t[1], assetsOwed: t[2], requestedAt: t[3], processed: t[4], claimed: t[5] } : null;
    })
    .filter(Boolean) as { id: number; owner: string; shares: bigint; assetsOwed: bigint; requestedAt: bigint; processed: boolean; claimed: boolean }[];
  return { rows, refetch };
}

/* ------------------------------------------------------------------ */
/*  Small UI                                                           */
/* ------------------------------------------------------------------ */

function Pill({ children, tone, icon }: { children: React.ReactNode; tone: "green" | "amber" | "red"; icon?: React.ReactNode }) {
  const c = {
    green: "bg-[var(--color-hz-green)]/10 text-[var(--color-hz-green)]",
    amber: "bg-[var(--color-hz-gold)]/25 text-[var(--color-hz-gold-deep)]",
    red: "bg-[var(--color-hz-danger)]/10 text-[var(--color-hz-danger)]",
  }[tone];
  return <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full ${c}`}>{icon}{children}</span>;
}

function StatusPill({ d }: { d: ReturnType<typeof useVaultData> }) {
  if (d.emergency) return <Pill tone="red" icon={<AlertTriangle className="w-3.5 h-3.5" />}>Emergency — open exit</Pill>;
  if (d.paused) return <Pill tone="amber">Paused</Pill>;
  if (d.unwindOnly) return <Pill tone="amber">Unwind-only (drawdown breaker)</Pill>;
  return <Pill tone="green" icon={<Activity className="w-3.5 h-3.5" />}>Active</Pill>;
}

function Stat({ label, value, sub, gold }: { label: string; value: string; sub?: string; gold?: boolean }) {
  return (
    <div className="card p-5">
      <div className="text-[11px] font-semibold text-[var(--color-ink-3)] uppercase tracking-wider">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${gold ? "text-[var(--color-hz-gold-deep)]" : "text-[var(--color-hz-navy)]"}`}>{value}</div>
      {sub && <div className="text-xs text-[var(--color-ink-3)] mt-0.5">{sub}</div>}
    </div>
  );
}

function TxButton({ onClick, busy, disabled, children, tone = "gold" }: { onClick: () => void; busy?: boolean; disabled?: boolean; children: React.ReactNode; tone?: "gold" | "navy" | "ghost" }) {
  const cls = tone === "gold" ? "btn-gold" : tone === "navy" ? "btn-navy" : "btn-ghost";
  return (
    <button onClick={onClick} disabled={busy || disabled} className={`${cls} w-full py-3 flex items-center justify-center gap-2`}>
      {busy && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Depositor view                                                     */
/* ------------------------------------------------------------------ */

function DepositorView() {
  const { address, isConnected } = useAccount();
  const d = useVaultData(address);
  const { rows, refetch: refetchReqs } = useRedeemRequests(d.requestCount);
  const { writeContractAsync } = useWriteContract();
  const [busy, setBusy] = useState<string | null>(null);
  const [depAmt, setDepAmt] = useState("");
  const [wdShares, setWdShares] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const dec = d.assetDecimals;

  const myRequests = rows.filter((r) => address && r.owner.toLowerCase() === address.toLowerCase());
  const userValue =
    d.userShares !== undefined && d.pricePerShare !== undefined ? (d.userShares * d.pricePerShare) / 10n ** 18n : undefined;
  const needsApproval = useMemo(() => {
    if (!depAmt || d.allowance === undefined) return false;
    try { return parseUnits(depAmt, dec) > d.allowance; } catch { return false; }
  }, [depAmt, d.allowance, dec]);

  async function run(key: string, fn: () => Promise<unknown>) {
    setErr(null);
    setBusy(key);
    try {
      await fn();
      d.refetch();
      refetchReqs();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const deposit = () =>
    run("deposit", async () => {
      const amt = parseUnits(depAmt, dec);
      if (needsApproval && d.asset) {
        await writeContractAsync({ address: d.asset, abi: ERC20_ABI, functionName: "approve", args: [VAULT, amt] });
      }
      await writeContractAsync({ address: VAULT, abi: VAULT_ABI, functionName: "deposit", args: [amt, address!] });
      setDepAmt("");
    });

  const instantWithdraw = () =>
    run("wd", async () => {
      await writeContractAsync({ address: VAULT, abi: VAULT_ABI, functionName: "redeem", args: [parseUnits(wdShares, 18), address!, address!] });
      setWdShares("");
    });

  const queueRedeem = () =>
    run("queue", async () => {
      const sh = parseUnits(wdShares, 18);
      await writeContractAsync({ address: VAULT, abi: VAULT_ABI, functionName: "approve", args: [VAULT, sh] });
      await writeContractAsync({ address: VAULT, abi: VAULT_ABI, functionName: "requestRedeem", args: [sh] });
      setWdShares("");
    });

  const emergencyRedeem = () =>
    run("emg", async () => {
      await writeContractAsync({ address: VAULT, abi: VAULT_ABI, functionName: "emergencyRedeem", args: [d.userShares!] });
    });

  const claim = (id: number) =>
    run(`claim-${id}`, async () => {
      await writeContractAsync({ address: VAULT, abi: VAULT_ABI, functionName: "claimRedeem", args: [BigInt(id)] });
    });

  const mintTest = () =>
    run("mint", async () => {
      if (!d.asset) return;
      await writeContractAsync({
        address: d.asset,
        abi: ERC20_ABI,
        functionName: "mint",
        args: [address!, parseUnits("10000", dec)],
      });
    });

  return (
    <div className="flex flex-col gap-6 animate-fadeIn">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Vault className="w-6 h-6 text-[var(--color-hz-gold-deep)]" /> Private Trading Vault
          </h1>
          <p className="text-[var(--color-ink-2)] text-sm mt-0.5">Pooled deposits · agent trades in a TEE · positions stay confidential</p>
        </div>
        <StatusPill d={d} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Vault NAV" value={fmt(d.totalAssets, dec, 2)} sub={d.assetSymbol} />
        <Stat label="Price / Share" value={fmt(d.pricePerShare, 18, 5)} sub={`HWM ${fmt(d.highWater, 18, 5)}`} gold />
        <Stat label="Your Shares" value={fmt(d.userShares, 18, 4)} sub="ptVAULT" />
        <Stat label="Your Value" value={fmt(userValue, dec, 2)} sub={d.assetSymbol} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-6 flex flex-col gap-4">
          <h3 className="font-bold flex items-center gap-2"><ArrowDownToLine className="w-5 h-5 text-[var(--color-hz-gold-deep)]" /> Deposit</h3>
          <div className="flex items-center justify-between gap-2 text-xs text-[var(--color-ink-3)]">
            <span>Wallet: {fmt(d.userAssetBal, dec, 2)} {d.assetSymbol} · Cap {fmt(d.depositCap, dec, 0)}</span>
            <button
              onClick={mintTest}
              disabled={!isConnected || busy === "mint"}
              className="shrink-0 font-semibold text-[var(--color-hz-blue)] hover:underline disabled:opacity-40 flex items-center gap-1"
              title={`Mint 10,000 test ${d.assetSymbol} to your wallet (testnet mock token)`}
            >
              {busy === "mint" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Droplets className="w-3 h-3" />}
              Get test {d.assetSymbol}
            </button>
          </div>
          <input value={depAmt} onChange={(e) => setDepAmt(e.target.value)} placeholder={`Amount in ${d.assetSymbol}`} inputMode="decimal" className="field" />
          <TxButton onClick={deposit} busy={busy === "deposit"} disabled={!isConnected || !depAmt || d.paused || d.emergency}>
            {needsApproval ? "Approve & Deposit" : "Deposit"}
          </TxButton>
          {(d.paused || d.emergency) && <p className="text-xs text-[var(--color-hz-gold-deep)]">Deposits disabled while {d.emergency ? "in emergency" : "paused"}.</p>}
        </div>

        <div className="card p-6 flex flex-col gap-4">
          <h3 className="font-bold flex items-center gap-2"><ArrowUpFromLine className="w-5 h-5 text-[var(--color-hz-navy)]" /> Withdraw</h3>
          <div className="text-xs text-[var(--color-ink-3)]">
            Idle liquidity: {fmt(d.idleLiquidity, dec, 2)} {d.assetSymbol}. Larger exits queue until the agent unwinds.
          </div>
          <input value={wdShares} onChange={(e) => setWdShares(e.target.value)} placeholder="Shares (ptVAULT)" inputMode="decimal" className="field" />
          <div className="grid grid-cols-2 gap-3">
            <TxButton onClick={instantWithdraw} busy={busy === "wd"} disabled={!isConnected || !wdShares || d.emergency} tone="navy">Instant</TxButton>
            <TxButton onClick={queueRedeem} busy={busy === "queue"} disabled={!isConnected || !wdShares || d.emergency} tone="ghost">Queue redemption</TxButton>
          </div>
          {d.emergency && (
            <TxButton onClick={emergencyRedeem} busy={busy === "emg"} disabled={!isConnected || !d.userShares} tone="ghost">
              Emergency redeem all ({fmt(d.userShares, 18, 2)} shares)
            </TxButton>
          )}
        </div>
      </div>

      <div className="card p-6">
        <h3 className="font-bold mb-3">Your redemption requests</h3>
        {myRequests.length === 0 ? (
          <p className="text-[var(--color-ink-3)] text-sm">None.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[var(--color-ink-3)] text-xs border-b border-[var(--color-border)]">
                  <th className="text-left pb-2 font-medium">#</th>
                  <th className="text-left pb-2 font-medium">Shares</th>
                  <th className="text-left pb-2 font-medium">Status</th>
                  <th className="text-left pb-2 font-medium">Owed</th>
                  <th className="text-right pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {myRequests.map((r) => (
                  <tr key={r.id} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="py-2.5 text-[var(--color-ink-3)]">{r.id}</td>
                    <td className="py-2.5 font-mono">{fmt(r.shares, 18, 4)}</td>
                    <td className="py-2.5">
                      {r.claimed ? <span className="text-[var(--color-ink-3)]">Claimed</span>
                        : r.processed ? <span className="text-[var(--color-hz-green)]">Ready</span>
                        : <span className="text-[var(--color-hz-gold-deep)]">Pending unwind</span>}
                    </td>
                    <td className="py-2.5 font-mono">{r.processed ? fmt(r.assetsOwed, dec, 2) : "—"}</td>
                    <td className="py-2.5 text-right">
                      {r.processed && !r.claimed && (
                        <button
                          onClick={() => claim(r.id)}
                          disabled={busy === `claim-${r.id}`}
                          className="px-3 py-1.5 rounded-lg bg-[var(--color-hz-green)]/15 text-[var(--color-hz-green)] text-xs font-semibold disabled:opacity-40"
                        >
                          {busy === `claim-${r.id}` ? "…" : "Claim"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {err && <p className="text-sm text-[var(--color-hz-danger)] break-words">{err}</p>}
      {!isConnected && (
        <div className="card p-8 text-center">
          <p className="text-[var(--color-ink-2)]">Connect a wallet on Horizen Testnet to deposit.</p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Manager view                                                       */
/* ------------------------------------------------------------------ */

function ManagerView() {
  const { address } = useAccount();
  const d = useVaultData(address);
  const { rows, refetch: refetchReqs } = useRedeemRequests(d.requestCount);
  const { writeContractAsync } = useWriteContract();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const reg = useReadContracts({
    contracts: ["agent", "isAgentLive", "attestationAge", "heartbeatAge", "attestationValidityPeriod", "heartbeatTimeout", "attestationURI"].map(
      (functionName) => ({ address: REGISTRY, abi: REGISTRY_ABI, functionName })
    ) as never[],
    query: { enabled: isAddr(REGISTRY), refetchInterval: 10_000 },
  });
  const rg = (i: number) => reg.data?.[i]?.result;
  const agent = rg(0) as string | undefined;
  const live = rg(1) as boolean | undefined;

  const pendingIds = rows.filter((r) => !r.processed).map((r) => r.id);
  const dec = d.assetDecimals;
  const deployedPct =
    d.deployedValue !== undefined && d.totalAssets && d.totalAssets > 0n
      ? Number((d.deployedValue * 10000n) / d.totalAssets) / 100
      : 0;

  async function run(key: string, fn: () => Promise<unknown>) {
    setErr(null);
    setBusy(key);
    try {
      await fn();
      d.refetch();
      refetchReqs();
      reg.refetch();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-fadeIn">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Cpu className="w-6 h-6 text-[var(--color-hz-navy)]" /> Manager Console
        </h1>
        <p className="text-[var(--color-ink-2)] text-sm mt-0.5">Supervisory controls. The autonomous agent trades on its own inside the TEE.</p>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className={`w-2.5 h-2.5 rounded-full ${live ? "bg-[var(--color-hz-green)]" : "bg-[var(--color-hz-danger)] animate-pulse"}`} />
            <div>
              <div className="font-semibold">{live ? "Agent live" : "Agent NOT live"}</div>
              <a href={`${EXPLORER}/address/${agent}`} target="_blank" rel="noreferrer" className="text-xs text-[var(--color-ink-2)] font-mono flex items-center gap-1 hover:text-[var(--color-hz-navy)]">
                {short(agent)} <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
          <div className="flex gap-6 text-sm">
            <div>
              <div className="text-[11px] text-[var(--color-ink-3)] uppercase">Attestation age</div>
              <div className="font-mono">{secs(rg(2) as bigint)} <span className="text-[var(--color-ink-3)]">/ {secs(rg(4) as bigint)}</span></div>
            </div>
            <div>
              <div className="text-[11px] text-[var(--color-ink-3)] uppercase">Heartbeat age</div>
              <div className="font-mono">{secs(rg(3) as bigint)} <span className="text-[var(--color-ink-3)]">/ {secs(rg(5) as bigint)}</span></div>
            </div>
          </div>
        </div>
        {typeof rg(6) === "string" && (rg(6) as string).length > 0 && (
          <div className="mt-3 text-xs text-[var(--color-ink-3)] break-all">Attestation doc: {rg(6) as string}</div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Max / trade" value={bps(d.maxTradeBps)} sub="of NAV" gold />
        <Stat label="Max deployed" value={bps(d.maxDeployedBps)} sub={`now ${deployedPct}%`} gold />
        <Stat label="Drawdown limit" value={bps(d.maxDrawdownBps)} sub="→ unwind-only" gold />
        <Stat label="Deployed value" value={fmt(d.deployedValue, dec, 2)} sub={d.assetSymbol} />
      </div>

      <div className="card p-6">
        <h3 className="font-bold mb-2">Held tokens (NAV legs)</h3>
        {d.heldTokens.length === 0 ? (
          <p className="text-[var(--color-ink-3)] text-sm">Fully in {d.assetSymbol}.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {d.heldTokens.map((t) => (
              <a key={t} href={`${EXPLORER}/address/${t}`} target="_blank" rel="noreferrer" className="text-xs font-mono px-3 py-1.5 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-ink-2)] hover:text-[var(--color-hz-navy)]">
                {short(t)}
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <TxButton onClick={() => run("pause", () => writeContractAsync({ address: VAULT, abi: VAULT_ABI, functionName: "pause" }))} busy={busy === "pause"} disabled={d.paused} tone="ghost">
          Pause vault
        </TxButton>
        <TxButton onClick={() => run("unpause", () => writeContractAsync({ address: VAULT, abi: VAULT_ABI, functionName: "unpause" }))} busy={busy === "unpause"} disabled={!d.paused || d.emergency} tone="ghost">
          Unpause
        </TxButton>
        <TxButton
          onClick={() => run("settle", () => writeContractAsync({ address: VAULT, abi: VAULT_ABI, functionName: "processRedeemRequests", args: [pendingIds.map((i) => BigInt(i))] }))}
          busy={busy === "settle"}
          disabled={pendingIds.length === 0}
          tone="navy"
        >
          Settle {pendingIds.length} redemption{pendingIds.length === 1 ? "" : "s"}
        </TxButton>
      </div>

      <div className="card p-6">
        <h3 className="font-bold mb-3">Redemption queue</h3>
        {rows.length === 0 ? (
          <p className="text-[var(--color-ink-3)] text-sm">Empty.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[var(--color-ink-3)] text-xs border-b border-[var(--color-border)]">
                  <th className="text-left pb-2 font-medium">#</th>
                  <th className="text-left pb-2 font-medium">Owner</th>
                  <th className="text-left pb-2 font-medium">Shares</th>
                  <th className="text-left pb-2 font-medium">State</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="py-2 text-[var(--color-ink-3)]">{r.id}</td>
                    <td className="py-2 font-mono text-[var(--color-ink-2)]">{short(r.owner)}</td>
                    <td className="py-2 font-mono">{fmt(r.shares, 18, 4)}</td>
                    <td className="py-2">{r.claimed ? "claimed" : r.processed ? "ready" : "pending"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ManagerConsole />
      {err && <p className="text-sm text-[var(--color-hz-danger)] break-words">{err}</p>}
    </div>
  );
}

function ManagerConsole() {
  const [input, setInput] = useState("");
  const [logs, setLogs] = useState<{ role: "user" | "system" | "error"; text: string; hash?: string }[]>([
    { role: "system", text: "Manager console. Try: 'status', 'pause the vault', 'settle redemptions 0,1', 'trade 1500 <tokenIn> into <tokenOut> min 0'." },
  ]);
  const [busy, setBusy] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    const prompt = input;
    setInput("");
    setLogs((l) => [...l, { role: "user", text: prompt }]);
    setBusy(true);
    try {
      const res = await fetch("/api/vault", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) });
      const data = await res.json();
      const role = data.status === "REJECTED" || data.status === "ERROR" ? "error" : "system";
      const prefix = data.status === "REJECTED" ? `REJECTED [${data.policyViolation}] ` : data.status === "SIMULATED" ? "SIMULATED · " : "";
      setLogs((l) => [...l, { role, text: prefix + (data.message ?? JSON.stringify(data)), hash: data.txHash }]);
    } catch (e) {
      setLogs((l) => [...l, { role: "error", text: e instanceof Error ? e.message : String(e) }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-6">
      <h3 className="font-bold mb-3 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-[var(--color-hz-gold-deep)]" /> NL command console</h3>
      <div className="flex flex-col gap-2 max-h-64 overflow-y-auto mb-3 pr-1">
        {logs.map((l, i) => (
          <div
            key={i}
            className={`text-sm p-3 rounded-xl max-w-[90%] whitespace-pre-line ${
              l.role === "user"
                ? "bg-[var(--color-hz-gold)]/20 self-end"
                : l.role === "error"
                ? "bg-[var(--color-hz-danger)]/10 text-[var(--color-hz-danger)] self-start"
                : "bg-[var(--color-surface-2)] self-start"
            }`}
          >
            {l.text}
            {l.hash && (
              <a href={`${EXPLORER}/tx/${l.hash}`} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1 text-xs text-[var(--color-hz-blue)]">
                View tx <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        ))}
        {busy && <div className="text-sm text-[var(--color-ink-3)] self-start flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> working…</div>}
      </div>
      <form onSubmit={send} className="flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Command…" className="field flex-1" />
        <button type="submit" className="btn-navy px-5 flex items-center gap-1.5">
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
