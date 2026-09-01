"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { Vault, ArrowLeftRight, Trophy, Loader2, ExternalLink, Zap, User } from "lucide-react";

import { CustomConnectButton } from "@/components/CustomConnectButton";
import addresses from "@/contracts/addresses.json";

const A = addresses as Record<string, string>;
const EXPLORER = "https://explorer-testnet.horizen.io";
const API = `${EXPLORER}/api`;
const XP_PER_TX = 20;

const isAddr = (x?: string): x is `0x${string}` => !!x && /^0x[a-fA-F0-9]{40}$/.test(x);
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const hue = (a: string) => parseInt(a.slice(2, 8), 16) % 360;

// every contract this project has deployed — current + superseded — so a wallet
// that tested against an earlier venue / token still shows up.
const CONTRACTS = (
  [
    [A.PrivateTradingVault, "Vault"],
    [A.ZenStakingPool, "Staking"],
    [A.TokenVendor, "Venue"],
    // legacy venue addresses (replaced by redeploys)
    ["0x5F78A883E1C91bE500A95C746713660E04bF4E89", "Venue"],
    ["0xa61934d9EdF67D2dBE660f0Ea404685139f9E7Ca", "Venue"],
  ] as [string, string][]
).filter(([a]) => isAddr(a));

// only genuine protocol actions earn XP — 20 each. Admin config, approvals,
// test-token mints and plain transfers never count, whoever sends them.
const COUNTED: Record<string, string> = {
  "0x6e553f65": "deposit",
  "0x94bf804d": "mint",
  "0xb460af94": "withdraw",
  "0xba087652": "redeem",
  "0xaa2f892d": "requestRedeem",
  "0xe46cf747": "claimRedeem",
  "0x3d61b286": "emergencyRedeem",
  "0xa694fc3a": "stake",
  "0x2e17de78": "unstake",
  "0x4e71d92d": "claim",
  "0xe9fad8ee": "exit",
  // venue swaps
  "0xfe029156": "swap", // new generic TokenVendor.swap(address,address,uint256,uint256)
  "0xd0febe4c": "buy",
  "0x3d870747": "sell",
  "0xa92a684b": "buy",
  "0x62856aff": "sell",
  "0xfbedd0d9": "swap",
  "0x2f94d492": "swap",
};

type Tx = { hash: string; from: string; label: string; method: string; ts: number };

export default function LeaderboardPage() {
  const { address } = useAccount();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [visible, setVisible] = useState(50);
  const [profiles, setProfiles] = useState<Record<string, { pfp: string; name: string }>>({});

  // pull any locally-saved profiles (picture + name) set on /profile
  useEffect(() => {
    try {
      const map: Record<string, { pfp: string; name: string }> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i) || "";
        const m = k.match(/^(pfp|name):(0x[a-f0-9]{40})$/);
        if (!m) continue;
        const a = m[2];
        map[a] = map[a] ?? { pfp: "", name: "" };
        map[a][m[1] as "pfp" | "name"] = localStorage.getItem(k) || "";
      }
      setProfiles(map);
    } catch {
      /* private mode */
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const seen = new Set<string>();
        const all: Tx[] = [];
        await Promise.all(
          CONTRACTS.map(async ([addr, label]) => {
            const r = await fetch(
              `${API}?module=account&action=txlist&address=${addr}&startblock=0&endblock=99999999&sort=desc`
            );
            const j = await r.json();
            if (!Array.isArray(j.result)) return;
            for (const t of j.result) {
              if ((t.to || "").toLowerCase() !== addr.toLowerCase()) continue; // deploys / outbound
              if (t.isError !== "0") continue;
              if (seen.has(t.hash)) continue;
              const from = (t.from || "").toLowerCase();
              const method = COUNTED[(t.input || "0x").slice(0, 10)];
              if (!method) continue; // admin / approve / test-mint / transfer — never scores
              seen.add(t.hash);
              all.push({ hash: t.hash, from, label, method, ts: Number(t.timeStamp) * 1000 });
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
          <Link href="/profile" className="px-3.5 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 text-[var(--color-ink-2)] hover:text-[var(--color-hz-navy)]">
            <User className="w-4 h-4" /> <span className="hidden sm:inline">Profile</span>
          </Link>
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
            {ranked.length === 0 ? (
              <div className="card p-10 text-center text-[var(--color-ink-3)]">No activity yet — be the first.</div>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  {ranked.slice(0, visible).map((u, i) => {
                    const you = address && u.addr === address.toLowerCase();
                    const p = profiles[u.addr];
                    return (
                      <div
                        key={u.addr}
                        className={`card px-4 py-3 flex items-center gap-3 ${you ? "ring-2 ring-[var(--color-hz-gold)]" : ""}`}
                      >
                        <span className="w-7 shrink-0 text-center font-mono text-sm text-[var(--color-ink-3)]">{i + 1}</span>
                        {p?.pfp ? (
                          <img src={p.pfp} alt="" className="w-9 h-9 shrink-0 rounded-full object-cover border border-[var(--color-border)]" />
                        ) : (
                          <span
                            className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                            style={{ background: `hsl(${hue(u.addr)} 55% 45%)` }}
                          >
                            {u.addr.slice(2, 4).toUpperCase()}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <a
                            href={`${EXPLORER}/address/${u.addr}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-sm hover:text-[var(--color-hz-navy)] inline-flex items-center gap-1"
                          >
                            <span className={p?.name ? "" : "font-mono"}>{p?.name || short(u.addr)}</span>
                            {you && <span className="text-[10px] uppercase bg-[var(--color-hz-gold)]/30 text-[var(--color-hz-gold-deep)] px-1.5 rounded">you</span>}
                            <ExternalLink className="w-3 h-3 text-[var(--color-ink-3)]" />
                          </a>
                          <div className="text-xs text-[var(--color-ink-3)] flex flex-wrap gap-x-2">
                            {p?.name && <span className="font-mono">{short(u.addr)}</span>}
                            <span>{p?.name ? "· " : ""}{u.total} transaction{u.total === 1 ? "" : "s"}</span>
                            {Object.entries(u.labels).map(([l, n]) => (
                              <span key={l}>· {l} {n}</span>
                            ))}
                          </div>
                        </div>
                        <span className="shrink-0 flex items-center gap-1.5 font-bold text-[var(--color-hz-navy)]">
                          <span className="w-6 h-6 rounded-md bg-[var(--color-hz-navy)] flex items-center justify-center">
                            <Zap className="w-3.5 h-3.5 text-[var(--color-hz-gold)]" fill="currentColor" />
                          </span>
                          {u.xp.toLocaleString()}
                          <span className="text-xs text-[var(--color-ink-3)] font-medium">XP</span>
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-col items-center gap-2">
                  {visible < ranked.length && (
                    <button onClick={() => setVisible((v) => v + 50)} className="btn-ghost px-6 py-2 text-sm font-semibold">
                      Show more
                    </button>
                  )}
                  <p className="text-xs text-[var(--color-ink-3)]">
                    Showing {Math.min(visible, ranked.length)} of {ranked.length} user{ranked.length === 1 ? "" : "s"}
                  </p>
                </div>
              </>
            )}

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
