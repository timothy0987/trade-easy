"use client";

import React from "react";
import Link from "next/link";
import { useAccount, useBalance, useReadContracts } from "wagmi";
import { formatUnits, type Abi } from "viem";
import { Vault, ArrowLeftRight, User, ExternalLink, Wallet, Coins } from "lucide-react";

import { CustomConnectButton } from "@/components/CustomConnectButton";
import addresses from "@/contracts/addresses.json";

const A = addresses as Record<string, string>;
const EXPLORER = "https://explorer-testnet.horizen.io";

const ERC20_ABI = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
] as const satisfies Abi;

const isAddr = (x?: string): x is `0x${string}` => !!x && /^0x[a-fA-F0-9]{40}$/.test(x);
const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—");
const fmt = (v: bigint | undefined, d = 18) =>
  v === undefined ? "—" : Number(formatUnits(v, d)).toLocaleString(undefined, { maximumFractionDigits: 4 });

// Curated tokens from addresses.json (dedup + only valid addresses)
const KNOWN = ([
  [A.TERA, "TERA"],
  [A.USDC, "USDC"],
  [A.ZEN, "tZEN"],
  [A.PrivateTradingVault, "ptVAULT"],
  [A.VaultAsset, "vUSD"],
] as [string, string][])
  .filter(([addr]) => isAddr(addr))
  .filter(([addr], i, arr) => arr.findIndex(([a]) => a.toLowerCase() === addr.toLowerCase()) === i);

function NavLink({ href, icon, label, active }: { href: string; icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <Link
      href={href}
      className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${
        active ? "bg-[var(--color-hz-gold)]/20 text-[var(--color-hz-navy)]" : "text-[var(--color-ink-2)] hover:text-[var(--color-hz-navy)]"
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}

export default function ProfilePage() {
  const { address, isConnected } = useAccount();

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
          <NavLink href="/vault" icon={<Vault className="w-4 h-4" />} label="Vault" />
          <NavLink href="/trade" icon={<ArrowLeftRight className="w-4 h-4" />} label="Trade" />
          <NavLink href="/profile" icon={<User className="w-4 h-4" />} label="Profile" active />
        </div>
        <CustomConnectButton />
      </nav>

      <div className="w-full max-w-3xl z-10 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <User className="w-6 h-6 text-[var(--color-hz-gold-deep)]" /> Profile
          </h1>
          <p className="text-[var(--color-ink-2)] text-sm mt-0.5">Your token balances on Horizen Testnet.</p>
        </div>

        {!isConnected ? (
          <div className="card p-10 text-center">
            <Wallet className="w-9 h-9 text-[var(--color-ink-3)] mx-auto mb-3" />
            <p className="text-[var(--color-ink-2)]">Connect a wallet on Horizen Testnet to see your balances.</p>
          </div>
        ) : (
          <Balances address={address as `0x${string}`} />
        )}
      </div>
    </main>
  );
}

function Balances({ address }: { address: `0x${string}` }) {
  const { data: native } = useBalance({ address, query: { refetchInterval: 12_000 } });

  const knownCalls = KNOWN.flatMap(([addr]) => [
    { address: addr as `0x${string}`, abi: ERC20_ABI, functionName: "balanceOf", args: [address] },
    { address: addr as `0x${string}`, abi: ERC20_ABI, functionName: "symbol" },
    { address: addr as `0x${string}`, abi: ERC20_ABI, functionName: "decimals" },
  ]);
  const { data: known } = useReadContracts({ contracts: knownCalls as never[], query: { refetchInterval: 12_000 } });

  const knownRows = KNOWN.map(([addr, fallback], i) => {
    const bal = known?.[i * 3]?.result as bigint | undefined;
    const sym = (known?.[i * 3 + 1]?.result as string | undefined) ?? fallback;
    const dec = Number((known?.[i * 3 + 2]?.result as number | undefined) ?? 18);
    return { addr, sym, bal, dec };
  });

  return (
    <>
      <div className="card p-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-[11px] font-semibold text-[var(--color-ink-3)] uppercase tracking-wider">Wallet</div>
          <a
            href={`${EXPLORER}/address/${address}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-sm flex items-center gap-1 hover:text-[var(--color-hz-navy)]"
          >
            {short(address)} <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <div className="text-right">
          <div className="text-[11px] font-semibold text-[var(--color-ink-3)] uppercase tracking-wider">ETH (gas)</div>
          <div className="text-xl font-bold text-[var(--color-hz-navy)]">
            {native ? Number(formatUnits(native.value, native.decimals)).toLocaleString(undefined, { maximumFractionDigits: 5 }) : "—"}
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="font-bold mb-3 flex items-center gap-2">
          <Coins className="w-5 h-5 text-[var(--color-hz-gold-deep)]" /> Token balances
        </h3>
        <TokenTable rows={knownRows} empty="No known tokens configured." />
      </div>
    </>
  );
}

function TokenTable({ rows, empty }: { rows: { addr: string; sym: string; bal: bigint | undefined; dec: number }[]; empty: string }) {
  if (rows.length === 0) return <p className="text-[var(--color-ink-3)] text-sm">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[var(--color-ink-3)] text-xs border-b border-[var(--color-border)]">
            <th className="text-left pb-2 font-medium">Token</th>
            <th className="text-right pb-2 font-medium">Balance</th>
            <th className="text-right pb-2 font-medium">Contract</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.addr} className="border-b border-[var(--color-border)] last:border-0">
              <td className="py-2.5 font-semibold">{r.sym}</td>
              <td className="py-2.5 text-right font-mono">{fmt(r.bal, r.dec)}</td>
              <td className="py-2.5 text-right">
                <a
                  href={`${EXPLORER}/token/${r.addr}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-xs text-[var(--color-hz-blue)] hover:underline inline-flex items-center gap-1"
                >
                  {short(r.addr)} <ExternalLink className="w-3 h-3" />
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
