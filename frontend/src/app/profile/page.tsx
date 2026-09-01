"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAccount, useBalance, useReadContract, useReadContracts, useWriteContract, usePublicClient } from "wagmi";
import { formatUnits, type Abi } from "viem";
import { Vault, ArrowLeftRight, Trophy, User, ExternalLink, Wallet, Coins, Camera, Loader2 } from "lucide-react";

import { CustomConnectButton } from "@/components/CustomConnectButton";
import addresses from "@/contracts/addresses.json";
import ProfileRegistryAbi from "@/contracts/ProfileRegistry.json";

const A = addresses as Record<string, string>;
const EXPLORER = "https://explorer-testnet.horizen.io";
const AVATAR_PX = 64;         // small — the avatar is stored on-chain
const MAX_AVATAR_BYTES = 12_000; // matches ProfileRegistry.MAX_URI_BYTES
const REGISTRY = A.ProfileRegistry as `0x${string}` | undefined;
const REG_ABI = ProfileRegistryAbi as Abi;

const isAddr = (x?: string): x is `0x${string}` => !!x && /^0x[a-fA-F0-9]{40}$/.test(x);
const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—");
const hue = (a: string) => parseInt(a.slice(2, 8), 16) % 360;
const fmt = (v: bigint | undefined, d = 18) =>
  v === undefined ? "—" : Number(formatUnits(v, d)).toLocaleString(undefined, { maximumFractionDigits: 4 });

const ERC20_ABI = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
] as const satisfies Abi;

const KNOWN = (
  [
    [A.TERA, "TERA"],
    [A.USDC, "USDC"],
    [A.ZEN, "ZEN"],
    [A.PrivateTradingVault, "ptVAULT"],
    [A.VaultAsset, "vUSD"],
  ] as [string, string][]
)
  .filter(([a]) => isAddr(a))
  .filter(([a], i, arr) => arr.findIndex(([b]) => b.toLowerCase() === a.toLowerCase()) === i);

function resizeToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = c.height = AVATAR_PX;
      const ctx = c.getContext("2d");
      if (!ctx) return reject(new Error("no canvas"));
      const s = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, AVATAR_PX, AVATAR_PX);
      resolve(c.toDataURL("image/jpeg", 0.55));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error("bad image"));
    img.src = URL.createObjectURL(file);
  });
}

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
          <img src="/logo.svg" alt="Private Vault" width={28} height={28} className="w-7 h-7" />
          <span className="font-extrabold tracking-tight text-[var(--color-hz-navy)] text-[15px] hidden sm:block">Private Vault</span>
        </div>
        <div className="flex gap-0.5 border-l border-r border-[var(--color-border)] px-2 mx-1">
          <NavLink href="/vault" icon={<Vault className="w-4 h-4" />} label="Vault" />
          <NavLink href="/trade" icon={<ArrowLeftRight className="w-4 h-4" />} label="Venue" />
          <NavLink href="/leaderboard" icon={<Trophy className="w-4 h-4" />} label="Leaderboard" />
          <NavLink href="/profile" icon={<User className="w-4 h-4" />} label="Profile" active />
        </div>
        <CustomConnectButton />
      </nav>

      <div className="w-full max-w-2xl z-10 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <User className="w-6 h-6 text-[var(--color-hz-gold-deep)]" /> Profile
          </h1>
          <p className="text-[var(--color-ink-2)] text-sm mt-0.5">Your picture, display name and token balances on Horizen Testnet.</p>
        </div>

        {!isConnected ? (
          <div className="card p-10 text-center">
            <Wallet className="w-9 h-9 text-[var(--color-ink-3)] mx-auto mb-3" />
            <p className="text-[var(--color-ink-2)]">Connect a wallet on Horizen Testnet.</p>
          </div>
        ) : (
          <>
            <IdentityCard address={address as `0x${string}`} />
            <BalancesCard address={address as `0x${string}`} />
          </>
        )}
      </div>
    </main>
  );
}

type ChainProfile = { name: string; avatarURI: string; updatedAt: bigint };

function IdentityCard({ address }: { address: `0x${string}` }) {
  const client = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const { data: onChain, refetch } = useReadContract({
    address: REGISTRY,
    abi: REG_ABI,
    functionName: "getProfile",
    args: [address],
    query: { enabled: isAddr(REGISTRY), refetchInterval: 30_000 },
  });
  const saved = onChain as ChainProfile | undefined;
  const savedName = saved?.name ?? "";
  const savedPfp = saved?.avatarURI ?? "";

  const [pfp, setPfp] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false); // image processing
  const [tx, setTx] = useState<"" | "save" | "clear">("");
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Seed local editor from chain once it loads / changes underneath us.
  useEffect(() => {
    setPfp(savedPfp);
    setName(savedName);
  }, [savedPfp, savedName]);

  const dirty = pfp !== savedPfp || name.trim() !== savedName;
  const hasProfile = !!savedName || !!savedPfp;

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setErr("");
    setBusy(true);
    try {
      const uri = await resizeToDataUri(f);
      if (uri.length > MAX_AVATAR_BYTES) throw new Error("Image is too large after compression — try a smaller one.");
      setPfp(uri);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Couldn't read that image");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const save = async () => {
    if (!isAddr(REGISTRY)) return;
    setErr("");
    setTx("save");
    try {
      const hash = await writeContractAsync({
        address: REGISTRY,
        abi: REG_ABI,
        functionName: "setProfile",
        args: [name.trim(), pfp],
      });
      await client?.waitForTransactionReceipt({ hash });
      await refetch();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message.split("\n")[0] : "Transaction failed");
    } finally {
      setTx("");
    }
  };

  const clear = async () => {
    if (!isAddr(REGISTRY)) return;
    setErr("");
    setTx("clear");
    try {
      const hash = await writeContractAsync({
        address: REGISTRY,
        abi: REG_ABI,
        functionName: "clearProfile",
        args: [],
      });
      await client?.waitForTransactionReceipt({ hash });
      setPfp("");
      setName("");
      await refetch();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message.split("\n")[0] : "Transaction failed");
    } finally {
      setTx("");
    }
  };

  if (!isAddr(REGISTRY)) {
    return (
      <div className="card p-6">
        <h3 className="font-bold mb-1.5 flex items-center gap-2">
          <User className="w-5 h-5 text-[var(--color-hz-gold-deep)]" /> Identity
        </h3>
        <p className="text-sm text-[var(--color-ink-2)]">
          The on-chain profile registry isn&apos;t deployed on this network yet. Run{" "}
          <code className="font-mono text-xs bg-[var(--color-surface-2)] border border-[var(--color-border)] px-1.5 py-0.5 rounded">
            npm run deploy:profile
          </code>{" "}
          in <span className="font-mono">contracts/</span>, then reload.
        </p>
      </div>
    );
  }

  const pending = tx !== "";

  return (
    <div className="card p-6 flex flex-col sm:flex-row gap-6 items-center sm:items-start">
      <div className="relative shrink-0">
        {pfp ? (
          <img src={pfp} alt="avatar" className="w-24 h-24 rounded-full object-cover border border-[var(--color-border)]" />
        ) : (
          <span
            className="w-24 h-24 rounded-full flex items-center justify-center text-2xl font-bold text-white"
            style={{ background: `hsl(${hue(address)} 55% 45%)` }}
          >
            {address.slice(2, 4).toUpperCase()}
          </span>
        )}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy || pending}
          className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-[var(--color-hz-navy)] text-white flex items-center justify-center shadow-md disabled:opacity-50"
          title="Choose photo"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
      </div>

      <div className="flex-1 w-full flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-[var(--color-ink-3)] uppercase tracking-wider">Display name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Add a name"
            maxLength={40}
            disabled={pending}
            className="field"
          />
        </div>
        <a
          href={`${EXPLORER}/address/${address}`}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-mono text-[var(--color-ink-2)] hover:text-[var(--color-hz-navy)] inline-flex items-center gap-1"
        >
          {short(address)} <ExternalLink className="w-3 h-3" />
        </a>

        <div className="flex flex-wrap items-center gap-2 mt-1">
          <button onClick={save} disabled={!dirty || busy || pending} className="btn-gold text-sm px-4 py-1.5 disabled:opacity-50 inline-flex items-center gap-1.5">
            {tx === "save" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {tx === "save" ? "Saving…" : "Save profile"}
          </button>
          {pfp && (
            <button onClick={() => setPfp("")} disabled={pending} className="btn-ghost text-sm px-3 py-1.5 disabled:opacity-50">
              Remove photo
            </button>
          )}
          {hasProfile && (
            <button onClick={clear} disabled={pending} className="text-xs text-[var(--color-hz-danger)] hover:underline disabled:opacity-50 inline-flex items-center gap-1">
              {tx === "clear" && <Loader2 className="w-3 h-3 animate-spin" />}
              {tx === "clear" ? "Clearing…" : "Clear on-chain profile"}
            </button>
          )}
        </div>

        {dirty && !pending && <p className="text-[11px] text-[var(--color-hz-gold-deep)]">Unsaved changes — Save profile writes them on-chain.</p>}
        {err && <p className="text-xs text-[var(--color-hz-danger)] break-words">{err}</p>}
        <p className="text-[11px] text-[var(--color-ink-3)]">
          Stored on-chain in <span className="font-mono">ProfileRegistry</span> — shared everywhere, including the leaderboard.
        </p>
      </div>
    </div>
  );
}

function BalancesCard({ address }: { address: `0x${string}` }) {
  const { data: native } = useBalance({ address, query: { refetchInterval: 12_000 } });

  const calls = KNOWN.flatMap(([addr]) => [
    { address: addr as `0x${string}`, abi: ERC20_ABI, functionName: "balanceOf", args: [address] },
    { address: addr as `0x${string}`, abi: ERC20_ABI, functionName: "symbol" },
    { address: addr as `0x${string}`, abi: ERC20_ABI, functionName: "decimals" },
  ]);
  const { data } = useReadContracts({ contracts: calls as never[], query: { refetchInterval: 12_000 } });

  const rows = KNOWN.map(([addr, fallback], i) => ({
    addr,
    bal: data?.[i * 3]?.result as bigint | undefined,
    sym: (data?.[i * 3 + 1]?.result as string | undefined) ?? fallback,
    dec: Number((data?.[i * 3 + 2]?.result as number | undefined) ?? 18),
  }));

  return (
    <div className="card p-6">
      <h3 className="font-bold mb-3 flex items-center gap-2">
        <Coins className="w-5 h-5 text-[var(--color-hz-gold-deep)]" /> Token balances
      </h3>
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
            <tr className="border-b border-[var(--color-border)]">
              <td className="py-2.5 font-semibold">ETH <span className="text-[10px] text-[var(--color-ink-3)] font-normal">gas</span></td>
              <td className="py-2.5 text-right font-mono">
                {native ? Number(formatUnits(native.value, native.decimals)).toLocaleString(undefined, { maximumFractionDigits: 5 }) : "—"}
              </td>
              <td className="py-2.5 text-right text-[var(--color-ink-3)] text-xs">native</td>
            </tr>
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
    </div>
  );
}
