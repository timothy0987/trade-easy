"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { Vault, ArrowLeftRight, Trophy, Loader2, ExternalLink } from "lucide-react";

import { CustomConnectButton } from "@/components/CustomConnectButton";
import addresses from "@/contracts/addresses.json";

const A = addresses as Record<string, string>;
const EXPLORER = "https://explorer-testnet.horizen.io";
const API = `${EXPLORER}/api`;
const XP_PER_TX = 20;

const isAddr = (x?: string): x is `0x${string}` => !!x && /^0x[a-fA-F0-9]{40}$/.test(x);
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

// contracts whose inbound user transactions count toward XP
const TRACKED = (
  [
    [A.PrivateTradingVault, "Vault"],
    [A.ZenStakingPool, "Staking"],
    [A.TokenVendor, "Venue"],
    [A.TERA, "TERA"],
    [A.USDC, "USDC"],
    [A.ZEN, "ZEN"],
  ] as [string, string][]
).filter(([a]) => isAddr(a));

const METHODS: Record<string, string> = {
  "0x6e553f65": "deposit",
  "0x94bf804d": "mint",
  "0xb460af94": "withdraw",
  "0xba087652": "redeem",
  "0x9f40a7b3": "requestRedeem",
  "0x1e9a6950": "claimRedeem",
  "0xa694fc3a": "stake",
  "0x2e17de78": "unstake",
  "0x4e71d92d": "claim",
  "0xe9fad8ee": "exit",
  "0x40c10f19": "mint",
  "0x095ea7b3": "approve",
  "0xd004f0f7": "swap",
};

type Tx = { hash: string; from: string; label: string; method: string; ts: number };

export default function LeaderboardPage() {
  const { address } = useAccount();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [txs, setTxs] = useState<Tx[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const all: Tx[] = [];
        await Promise.all(
          TRACKED.map(async ([addr, label]) => {
            const r = await fetch(
              `${API}?module=account&action=txlist&address=${addr}&startblock=0&endblock=99999999&sort=desc`
            );
            const j = await r.json();
            if (!Array.isArray(j.result)) return;
            for (const t of j.result) {
              if ((t.to || "").toLowerCase() !== addr.toLowerCase()) continue; // skip deploys / outbound
              if (t.isError !== "0") continue;
              all.push({
                hash: t.hash,
                from: (t.from || "").toLowerCase(),
                label,
                method: METHODS[(t.input || "0x").slice(0, 10)] ?? (t.input === "0x" ? "transfer" : "call"),
                ts: Number(t.timeStamp) * 1000,
              });
            }
          })
        );
        if (alive) {
          setTxs(all.sort((a, b) => b.ts - a.ts));
          setLoading(false);
        }
      } catch (e) {
        if (alive) {
          setErr(e instanceof Error ? e.message : "Failed to load activity");
          setLoading(false);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // aggregate per user
  const byUser = new Map<string, { total: number; labels: Record<string, number> }>();
  for (const t of txs) {
    const u = byUser.get(t.from) ?? { total: 0, labels: {} };
    u.total += 1;
    u.labels[t.label] = (u.labels[t.label] ?? 0) + 1;
    byUser.set(t.from, u);
  }
  const ranked = [...byUser.entries()]
    .map(([addr, s]) => ({ addr, ...s, xp: s.total * XP_PER_TX }))
    .sort((a, b) => b.xp - a.xp);

  const totalTx = txs.length;
  const totalXp = totalTx * XP_PER_TX;

  return (
    <main className="min-h-screen px-4 pb-20 pt-28 flex flex-col items-center">
      <div className="ambient-glow-purple top-0 -left-20" />
      <div className="ambient-glow-teal bottom-0 -right-20" />

      <nav className="levitating-nav">
        <div className="flex items-center gap-2 pl-2 pr-1">
          <img src="/logo.svg" alt="Private Vault" width={28} height={28} className="w-7 h-7" />
          <span className="font-extrabold tracking-tight text-[var(--color-hz-navy)] text-[15px] hidden sm:block">Private Vault</span>
        </div>
        <div className="flex gap-0.5 border-l border-r border-[var(--color-border)] px-2 mx-1">
          <Link href="/vault" className="px-3.5 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 text-[var(--color-ink-2)] hover:text-[var(--color-hz-navy)]">
            <Vault className="w-4 h-4" /> <span className="hidden sm:inline">Vault</span>
          </Link>
          <Link href="/trade" className="px-3.5 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 text-[var(--color-ink-2)] hover:text-[var(--color-hz-navy)]">
            <ArrowLeftRight className="w-4 h-4" /> <span className="hidden sm:inline">Venue</span>
          </Link>
          <span className="px-3.5 py-1.5 rounded-full text-sm font-medium flex items-center gap-1.5 bg-[var(--color-hz-gold)]/20 text-[var(--color-hz-navy)]">
            <Trophy className="w-4 h-4" /> <span className="hidden sm:inline">Leaderboard</span>
          </span>
        </div>
        <CustomConnectButton />
      </nav>

      <div className="w-full max-w-3xl z-10 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="w-6 h-6 text-[var(--color-hz-gold-deep)]" /> Leaderboard
          </h1>
          <p className="text-[var(--color-ink-2)] text-sm mt-0.5">
            Every on-chain transaction with the vault, venue or staking pool earns <b>{XP_PER_TX} XP</b>.
            Read straight from the Horizen explorer — nothing to opt into.
          </p>
        </div>

        {loading ? (
          <div className="card p-10 text-center flex items-center justify-center gap-2 text-[var(--color-ink-2)]">
            <Loader2 className="w-5 h-5 animate-spin" /> Reading on-chain activity…
          </div>
        ) : err ? (
          <div className="card p-8 text-center text-[var(--color-hz-danger)]">{err}</div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4">
              <Stat label="Users" value={ranked.length.toLocaleString()} />
              <Stat label="Transactions" value={totalTx.toLocaleString()} gold />
              <Stat label="XP awarded" value={totalXp.toLocaleString()} gold />
            </div>

            <div className="card p-6">
              <h3 className="font-bold mb-3">Ranking</h3>
              {ranked.length === 0 ? (
                <p className="text-[var(--color-ink-3)] text-sm">No activity yet — be the first.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[var(--color-ink-3)] text-xs border-b border-[var(--color-border)]">
                        <th className="text-left pb-2 font-medium w-8">#</th>
                        <th className="text-left pb-2 font-medium">Address</th>
                        <th className="text-left pb-2 font-medium">Activity</th>
                        <th className="text-right pb-2 font-medium">Txns</th>
                        <th className="text-right pb-2 font-medium">XP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ranked.map((u, i) => {
                        const you = address && u.addr === address.toLowerCase();
                        return (
                          <tr key={u.addr} className={`border-b border-[var(--color-border)] last:border-0 ${you ? "bg-[var(--color-hz-gold)]/10" : ""}`}>
                            <td className="py-2.5 font-mono text-[var(--color-ink-3)]">{i + 1}</td>
                            <td className="py-2.5">
                              <a href={`${EXPLORER}/address/${u.addr}`} target="_blank" rel="noreferrer" className="font-mono text-xs hover:text-[var(--color-hz-navy)] inline-flex items-center gap-1">
                                {short(u.addr)} {you && <span className="text-[10px] uppercase bg-[var(--color-hz-gold)]/30 text-[var(--color-hz-gold-deep)] px-1.5 rounded">you</span>}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </td>
                            <td className="py-2.5">
                              <span className="flex flex-wrap gap-1">
                                {Object.entries(u.labels).map(([l, n]) => (
                                  <span key={l} className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-ink-2)]">
                                    {l} {n}
                                  </span>
                                ))}
                              </span>
                            </td>
                            <td className="py-2.5 text-right font-mono">{u.total}</td>
                            <td className="py-2.5 text-right font-mono font-bold text-[var(--color-hz-gold-deep)]">{u.xp}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="card p-6">
              <h3 className="font-bold mb-3">Recent activity</h3>
              {txs.length === 0 ? (
                <p className="text-[var(--color-ink-3)] text-sm">Nothing yet.</p>
              ) : (
                <ul className="flex flex-col gap-2 text-sm">
                  {txs.slice(0, 20).map((t) => (
                    <li key={t.hash} className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[var(--color-hz-navy)]/10 text-[var(--color-hz-navy)] shrink-0">{t.label}</span>
                        <span className="font-mono text-xs text-[var(--color-ink-2)]">{t.method}</span>
                        <span className="font-mono text-xs text-[var(--color-ink-3)] truncate">{short(t.from)}</span>
                      </span>
                      <a href={`${EXPLORER}/tx/${t.hash}`} target="_blank" rel="noreferrer" className="text-xs text-[var(--color-hz-blue)] shrink-0 inline-flex items-center gap-1">
                        {new Date(t.ts).toLocaleDateString()} <ExternalLink className="w-3 h-3" />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className="card p-5">
      <div className="text-[11px] font-semibold text-[var(--color-ink-3)] uppercase tracking-wider">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${gold ? "text-[var(--color-hz-gold-deep)]" : "text-[var(--color-hz-navy)]"}`}>{value}</div>
    </div>
  );
}
