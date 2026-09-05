import Link from "next/link";
import {
  ShieldCheck,
  Lock,
  FileCheck2,
  Cpu,
  ArrowRight,
  GaugeCircle,
  Coins,
  ListChecks,
  CircleDot,
  Boxes,
  ScrollText,
} from "lucide-react";

import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";

/* Vault-first landing page. The product is the private agentic trading vault;
   this page states the thesis, draws the confidentiality boundary, and sends
   people into /vault or the architecture note. Static — no wallet needed. */

const REPO = "https://github.com/timothy0987/trade-easy";

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-ink-3)]">
      {children}
    </div>
  );
}

const CONFIDENTIAL = [
  "Portfolio composition — which tokens, in what size",
  "Entry and exit prices, trade timing, venue routing",
  "Strategy code and parameters",
];

const PUBLIC = [
  "Shares outstanding, deposits, redemptions — plain ERC-4626",
  "Attested NAV, share price, and the solvency-proof result",
  "Mandate parameters and drawdown-breaker state",
];

const STEPS = [
  {
    n: "01",
    title: "Deposit",
    body: "Capital pools into a standard ERC-4626 vault. You hold shares; the settlement buffer stays on-chain in the clear.",
  },
  {
    n: "02",
    title: "The agent trades",
    body: "An autonomous agent deploys capital under an on-chain mandate — per-trade cap, deployed cap, drawdown breaker. Positions are held by enclave-bound execution accounts.",
  },
  {
    n: "03",
    title: "NAV is attested",
    body: "Each epoch a single scalar — the aggregate mark-to-market value — is signed inside the enclave and posted back. Share price is derived only from verified attestations.",
  },
  {
    n: "04",
    title: "Solvency is proven",
    body: "A zero-knowledge proof over the hidden balances shows the vault is solvent and mandate-compliant — without revealing a single position.",
  },
];

const FEATURES = [
  {
    Icon: GaugeCircle,
    title: "Agent mandate & breaker",
    body: "maxTradeBps, maxDeployedBps, maxDrawdownBps enforced on-chain. Breach the drawdown limit and the agent drops to unwind-only.",
  },
  {
    Icon: ListChecks,
    title: "Redemption queue",
    body: "Idle liquidity redeems instantly; larger exits queue and settle at attested NAV once the agent unwinds. No forced fire-sales.",
  },
  {
    Icon: Coins,
    title: "Fees as dilution shares",
    body: "Management and performance fees mint against a high-water mark — no asset transfers, no surprise withdrawals from the buffer.",
  },
  {
    Icon: Boxes,
    title: "ZEN staking fee-share",
    body: "A fixed share of every fee accrual routes to the ZEN staking pool, tying vault performance to the Horizen ecosystem.",
  },
];

const ROADMAP = [
  { tag: "Live", label: "Vault, agent mandate, redemption queue and breaker — deployed on Horizen Testnet." },
  { tag: "M1", label: "Remove heldTokens / deployedValue from the contract; positions leave the public surface." },
  { tag: "M2", label: "Execution moves into a TEE; NAV arrives as an enclave-signed attestation." },
  { tag: "M3", label: "Zero-knowledge solvency proof over hidden balances, verified on-chain each epoch." },
];

export default function Home() {
  return (
    <main className="min-h-screen px-4 pb-20 pt-28 sm:pt-32 flex flex-col items-center">
      <div className="ambient-glow-purple top-0 -left-20" />
      <div className="ambient-glow-teal bottom-0 -right-20" />

      <SiteNav />

      <div className="w-full max-w-5xl z-10 flex flex-col">
        {/* ---------------------------------------------------------------- Hero */}
        <section className="pt-6 sm:pt-10">
          <Eyebrow>Private agentic trading vault · Horizen</Eyebrow>

          <h1 className="font-display mt-4 text-[2.4rem] sm:text-[3.25rem] lg:text-[3.75rem] leading-[1.04] font-bold tracking-[-0.02em] text-[var(--color-hz-navy)] max-w-3xl">
            Confidential positions,
            <br className="hidden sm:block" /> provable solvency.
          </h1>

          <p className="mt-5 text-[var(--color-ink-2)] text-base sm:text-lg leading-relaxed max-w-2xl">
            A pooled vault where an autonomous agent trades under an on-chain mandate. Its holdings and
            strategy never touch the chain — the vault&apos;s solvency and share price are proven on it
            every epoch.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/vault" className="btn-navy px-5 py-2.5 text-sm inline-flex items-center gap-2">
              Enter the vault <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
            <a
              href="/architecture.html"
              target="_blank"
              rel="noreferrer"
              className="btn-ghost px-5 py-2.5 text-sm inline-flex items-center gap-2"
            >
              <ScrollText className="w-4 h-4" aria-hidden="true" /> How it works
            </a>
            <span className="font-mono text-[11px] uppercase tracking-wider px-2 py-1 rounded bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-ink-3)]">
              Testnet · chain 2651420
            </span>
          </div>
        </section>

        {/* ---------------------------------------------------- Trust boundary */}
        <section className="mt-16 sm:mt-24">
          <Eyebrow>The trust boundary</Eyebrow>
          <h2 className="font-display mt-3 text-[1.6rem] sm:text-[1.9rem] font-bold tracking-[-0.015em] text-[var(--color-hz-navy)]">
            Two places capital can sit
          </h2>
          <p className="mt-2 text-[var(--color-ink-2)] text-sm max-w-2xl">
            The settlement buffer is on-chain and legible. Deployed capital lives behind enclave-held
            keys — only the aggregate value ever crosses back.
          </p>

          <div className="card mt-6 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[var(--color-border)] overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-2 text-[var(--color-hz-navy)]">
                <ShieldCheck className="w-4 h-4 text-[var(--color-hz-gold-deep)]" aria-hidden="true" />
                <span className="font-semibold text-sm">On-chain — public, trust-minimised</span>
              </div>
              <ul className="mt-4 flex flex-col gap-3">
                {PUBLIC.map((t) => (
                  <li key={t} className="flex gap-2.5 text-sm text-[var(--color-ink-2)] leading-snug">
                    <CircleDot className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[var(--color-hz-gold-deep)]" aria-hidden="true" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-6 bg-[var(--color-surface-2)]/40">
              <div className="flex items-center gap-2 text-[var(--color-hz-navy)]">
                <Lock className="w-4 h-4 text-[var(--color-hz-gold-deep)]" aria-hidden="true" />
                <span className="font-semibold text-sm">In-enclave — confidential, attested</span>
              </div>
              <ul className="mt-4 flex flex-col gap-3">
                {CONFIDENTIAL.map((t) => (
                  <li key={t} className="flex gap-2.5 text-sm text-[var(--color-ink-2)] leading-snug">
                    <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[var(--color-ink-3)]" aria-hidden="true" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="mt-3 text-xs text-[var(--color-ink-3)]">
            Depositor-level privacy (who deposited, how much) is out of scope — that&apos;s an additive
            shielded-deposit layer on the roadmap.
          </p>
        </section>

        {/* ------------------------------------------------------ How it works */}
        <section className="mt-16 sm:mt-24">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="font-display mt-3 text-[1.6rem] sm:text-[1.9rem] font-bold tracking-[-0.015em] text-[var(--color-hz-navy)]">
            From deposit to proof
          </h2>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {STEPS.map((s) => (
              <div key={s.n} className="card p-6">
                <div className="font-mono text-xs text-[var(--color-hz-gold-deep)]">{s.n}</div>
                <div className="mt-2 font-semibold text-[var(--color-hz-navy)]">{s.title}</div>
                <p className="mt-1.5 text-sm text-[var(--color-ink-2)] leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* --------------------------------------------------------- Features */}
        <section className="mt-16 sm:mt-24">
          <Eyebrow>What&apos;s already on-chain</Eyebrow>
          <h2 className="font-display mt-3 text-[1.6rem] sm:text-[1.9rem] font-bold tracking-[-0.015em] text-[var(--color-hz-navy)]">
            The mechanism, not just the promise
          </h2>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FEATURES.map(({ Icon, title, body }) => (
              <div key={title} className="card p-6">
                <Icon className="w-5 h-5 text-[var(--color-hz-gold-deep)]" aria-hidden="true" />
                <div className="mt-3 font-semibold text-[var(--color-hz-navy)]">{title}</div>
                <p className="mt-1.5 text-sm text-[var(--color-ink-2)] leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------------- Roadmap */}
        <section className="mt-16 sm:mt-24">
          <Eyebrow>Status</Eyebrow>
          <h2 className="font-display mt-3 text-[1.6rem] sm:text-[1.9rem] font-bold tracking-[-0.015em] text-[var(--color-hz-navy)]">
            Live prototype, honest roadmap
          </h2>
          <p className="mt-2 text-[var(--color-ink-2)] text-sm max-w-2xl">
            The vault, mandate and redemption logic run today on Horizen Testnet with test tokens. The
            confidential-execution layer — enclave and proofs — is next.
          </p>

          <ul className="card mt-6 divide-y divide-[var(--color-border)] overflow-hidden">
            {ROADMAP.map((r) => (
              <li key={r.tag} className="flex items-start gap-4 p-4">
                <span
                  className={`font-mono text-[11px] font-medium px-2 py-0.5 rounded shrink-0 ${
                    r.tag === "Live"
                      ? "bg-[var(--color-hz-green-soft)] text-[var(--color-hz-green)]"
                      : "bg-[var(--color-hz-navy-tint)] text-[var(--color-hz-navy)]"
                  }`}
                >
                  {r.tag}
                </span>
                <span className="text-sm text-[var(--color-ink-2)] leading-snug">{r.label}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* -------------------------------------------------------------- CTA */}
        <section className="mt-16 sm:mt-24">
          <div className="card card-raised p-8 sm:p-10 text-center">
            <Cpu className="w-6 h-6 mx-auto text-[var(--color-hz-gold-deep)]" aria-hidden="true" />
            <h2 className="font-display mt-3 text-[1.7rem] sm:text-[2rem] font-bold tracking-[-0.015em] text-[var(--color-hz-navy)]">
              Try it on testnet
            </h2>
            <p className="mt-2 text-sm text-[var(--color-ink-2)] max-w-md mx-auto">
              Mint test tokens, deposit, watch the agent trade under its mandate, and queue a
              redemption — no real funds involved.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link href="/vault" className="btn-navy px-5 py-2.5 text-sm inline-flex items-center gap-2">
                Enter the vault <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
              <a
                href={REPO}
                target="_blank"
                rel="noreferrer"
                className="btn-ghost px-5 py-2.5 text-sm inline-flex items-center gap-2"
              >
                <FileCheck2 className="w-4 h-4" aria-hidden="true" /> Read the source
              </a>
            </div>
          </div>
        </section>
      </div>

      <SiteFooter />
    </main>
  );
}
