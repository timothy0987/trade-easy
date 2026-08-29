"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  useAccount,
  useWriteContract,
  useReadContract,
  usePublicClient,
  useWalletClient,
  useSwitchChain,
} from "wagmi";
import { parseEther, encodeFunctionData, toHex, erc20Abi } from "viem";
import {
  Coins,
  ArrowLeftRight,
  Bot,
  ChevronRight,
  Cpu,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  ExternalLink,
  User,
  Droplets,
  Vault,
} from "lucide-react";

import { CustomConnectButton } from "@/components/CustomConnectButton";
import addresses from "@/contracts/addresses.json";
import TokenCreatorAbi from "@/contracts/TokenCreator.json";
import TokenVendorAbi from "@/contracts/TokenVendor.json";
import TeraFaucetAbi from "@/contracts/TeraFaucet.json";

const HORIZEN_CHAIN_ID = 2651420;
const EXPLORER = "https://explorer-testnet.horizen.io";
const A = addresses as Record<string, string>;

// Horizen Testnet gas is ETH (bridged from Base Sepolia via the hub — no ZEN faucet).
const TESTNET_HUB_URL = "https://hub-testnet.horizen.io/";
const TESTNET_DOCS_URL = "https://horizen-2-docs.horizen.io/horizen-chain/network/testnet";

// Native gas sentinel — Horizen's gas token is ETH.
const NATIVE = "ETH";

type TabKey = "swap" | "agent" | "faucet" | "mint";

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
    ? "tZEN"
    : isCustom
    ? `${value.slice(0, 10)}…`
    : placeholder;

  const Row = ({
    onClick,
    children,
  }: {
    onClick: () => void;
    children: React.ReactNode;
  }) => (
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
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="field flex justify-between items-center cursor-pointer"
      >
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
              <span>tZEN</span>
              <span className="text-[10px] uppercase tracking-wider bg-[var(--color-hz-green)]/15 text-[var(--color-hz-green)] px-2 py-0.5 rounded-full">Testnet ZEN</span>
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

function NavTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${
        active
          ? "bg-[var(--color-hz-gold)]/20 text-[var(--color-hz-navy)]"
          : "text-[var(--color-ink-2)] hover:text-[var(--color-hz-navy)]"
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

export default function Home() {
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

  /* -------- Mint -------- */
  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [tokenDecimals, setTokenDecimals] = useState("18");
  const [initialSupply, setInitialSupply] = useState("");
  const [creationFee, setCreationFee] = useState("0");
  const [mintingTx, setMintingTx] = useState(false);
  const [userTokenList, setUserTokenList] = useState<string[]>([]);

  const { data: createdTokens, refetch: refetchTokens } = useReadContract({
    address: A.TokenCreator as `0x${string}`,
    abi: TokenCreatorAbi,
    functionName: "getUserTokens",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!A.TokenCreator },
  });
  useEffect(() => {
    if (createdTokens) setUserTokenList(createdTokens as string[]);
  }, [createdTokens]);

  const handleMint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) return showToast("Connect your wallet first");
    if (!tokenName || !tokenSymbol || !initialSupply) return showToast("All fields are required");
    setMintingTx(true);
    try {
      if (!A.TokenCreator) throw new Error("Token factory address missing from addresses.json");
      if (!walletClient) throw new Error("Wallet client not found");
      await ensureHorizen();
      const tx = await walletClient.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: address,
            to: A.TokenCreator as `0x${string}`,
            data: encodeFunctionData({
              abi: TokenCreatorAbi,
              functionName: "createToken",
              args: [tokenName, tokenSymbol, BigInt(initialSupply), parseInt(tokenDecimals)],
            }),
            value: toHex(parseEther(creationFee || "0")),
          },
        ],
      });
      showToast(`Token creation submitted: ${tx}`);
      setTokenName("");
      setTokenSymbol("");
      setInitialSupply("");
      setTimeout(() => refetchTokens(), 5000);
    } catch (err) {
      showToast(`Token creation failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setMintingTx(false);
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
    const tera = A.TERA;
    const usdc = A.USDC;
    if (!vendor) return showToast("TokenVendor address missing from addresses.json");

    setIsSwapping(true);
    try {
      const amount = parseEther(swapAmountIn);
      await ensureHorizen();

      let fn = "";
      if (tokenA === NATIVE && tokenB === tera) fn = "buyTokens";
      else if (tokenA === tera && tokenB === NATIVE) fn = "sellTerra";
      else if (tokenA === NATIVE && tokenB === usdc) fn = "buyUsdc";
      else if (tokenA === usdc && tokenB === NATIVE) fn = "sellUsdc";
      else if (tokenA === tera && tokenB === usdc) fn = "swapTerraForUsdc";
      else if (tokenA === usdc && tokenB === tera) fn = "swapUsdcForTerra";
      else throw new Error("Unsupported swap route.");

      const abi = Array.isArray(TokenVendorAbi) ? TokenVendorAbi : (TokenVendorAbi as { abi: unknown[] }).abi;

      if (tokenA !== NATIVE) {
        const tokenAddr = tokenA === tera ? tera : usdc;
        await walletClient.writeContract({
          account: address as `0x${string}`,
          address: tokenAddr as `0x${string}`,
          abi: erc20Abi,
          functionName: "approve",
          args: [vendor as `0x${string}`, amount],
        });
        await new Promise((r) => setTimeout(r, 4000));
      }

      let txHash: `0x${string}`;
      if (tokenA === NATIVE) {
        txHash = await walletClient.writeContract({
          account: address as `0x${string}`,
          address: vendor as `0x${string}`,
          abi: abi as never,
          functionName: fn as never,
          value: amount,
        });
      } else {
        txHash = await walletClient.writeContract({
          account: address as `0x${string}`,
          address: vendor as `0x${string}`,
          abi: abi as never,
          functionName: fn as never,
          args: [amount] as never,
        });
      }

      showToast(`Swap submitted: ${txHash}`);
      setSwapAmountIn("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(/reject|denied|4001/i.test(msg) ? "Transaction rejected" : `Swap failed: ${msg}`);
    } finally {
      setIsSwapping(false);
    }
  };

  const amountLabel =
    tokenA === NATIVE ? NATIVE : tokenA === A.TERA ? "TERA" : tokenA === A.USDC ? "USDC" : "TOKEN";

  /* -------- Agent -------- */
  const [agentInput, setAgentInput] = useState("");
  const [agentSelectedToken, setAgentSelectedToken] = useState("");
  const [agentStatus, setAgentStatus] = useState<"idle" | "thinking" | "done" | "rejected">("idle");
  const [agentLogs, setAgentLogs] = useState<
    Array<{ type: "user" | "agent" | "system" | "error"; text: string; hash?: string }>
  >([
    {
      type: "agent",
      text: "Online. Policy enforcement active: max 100 ETH / 1000 tokens per trade, contract allow-list enforced. How can I help on Horizen Testnet?",
    },
  ]);

  const handleAgentCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentInput.trim()) return;
    const msg = agentInput;
    setAgentInput("");
    setAgentLogs((l) => [...l, { type: "user", text: msg }]);
    setAgentStatus("thinking");
    try {
      const body: Record<string, string> = { prompt: msg };
      if (address) body.userAddress = address;
      if (agentSelectedToken) body.contextToken = agentSelectedToken;
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.status === "REJECTED") {
        setAgentStatus("rejected");
        setAgentLogs((l) => [...l, { type: "error", text: `POLICY REJECTED [${data.policyViolation}]: ${data.message}` }]);
      } else if (data.status === "SUCCESS") {
        setAgentStatus("done");
        setAgentLogs((l) => [...l, { type: "agent", text: `Guardrails passed. ${data.message}`, hash: data.txHash }]);
      } else if (data.status === "SIMULATED") {
        setAgentStatus("done");
        setAgentLogs((l) => [...l, { type: "system", text: `Simulated. ${data.message}` }]);
      } else {
        setAgentStatus("done");
        setAgentLogs((l) => [...l, { type: "agent", text: data.message || "Done." }]);
      }
    } catch (err) {
      setAgentStatus("idle");
      setAgentLogs((l) => [...l, { type: "error", text: `Error: ${err instanceof Error ? err.message : err}` }]);
    }
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
    } catch (err) {
      showToast(`Claim failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setFaucetTx(false);
    }
  };

  /* ---------------------------------------------------------------- */

  return (
    <main className="min-h-screen px-4 pb-20 pt-28 flex flex-col items-center">
      <div className="ambient-glow-purple top-0 -left-20" />
      <div className="ambient-glow-teal bottom-0 -right-20" />

      <nav className="levitating-nav">
        <div className="flex items-center gap-2 pl-2 pr-1">
          <span className="w-6 h-6 rounded-md bg-[var(--color-hz-navy)] flex items-center justify-center">
            <span className="w-2.5 h-2.5 rounded-[3px] bg-[var(--color-hz-gold)]" />
          </span>
          <span className="font-extrabold tracking-tight text-[var(--color-hz-navy)] text-[15px] hidden sm:block">
            Trade Easy
          </span>
        </div>
        <div className="flex gap-0.5 border-l border-r border-[var(--color-border)] px-2 mx-1">
          <NavTab active={tab === "swap"} onClick={() => setTab("swap")} icon={<ArrowLeftRight className="w-4 h-4" />} label="Swap" />
          <NavTab active={tab === "agent"} onClick={() => setTab("agent")} icon={<Bot className="w-4 h-4" />} label="AI Agent" />
          <NavTab active={tab === "faucet"} onClick={() => setTab("faucet")} icon={<Droplets className="w-4 h-4" />} label="Faucet" />
          <NavTab active={tab === "mint"} onClick={() => setTab("mint")} icon={<Coins className="w-4 h-4" />} label="Mint" />
          <Link
            href="/vault"
            className="px-3.5 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 text-[var(--color-ink-2)] hover:text-[var(--color-hz-navy)]"
          >
            <Vault className="w-4 h-4" />
            <span className="hidden sm:inline">Vault</span>
          </Link>
          <Link
            href="/profile"
            className="px-3.5 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 text-[var(--color-ink-2)] hover:text-[var(--color-hz-navy)]"
          >
            <User className="w-4 h-4" />
            <span className="hidden sm:inline">Profile</span>
          </Link>
        </div>

        <div className="hidden md:flex items-center gap-2 border-r border-[var(--color-border)] pr-3 mr-1">
          <span className="text-[11px] font-mono font-semibold text-[var(--color-ink-2)] bg-[var(--color-surface-2)] border border-[var(--color-border)] px-2.5 py-1 rounded-lg">
            Horizen&nbsp;<span className="text-[var(--color-hz-gold-deep)]">Testnet</span>
          </span>
          <span className="text-[11px] font-mono font-semibold text-[var(--color-ink-2)] bg-[var(--color-surface-2)] border border-[var(--color-border)] px-2.5 py-1 rounded-lg">
            $TERA
          </span>
        </div>

        <CustomConnectButton />
      </nav>

      <div className="w-full max-w-4xl z-10 flex flex-col gap-8">
        {/* ---------------- SWAP ---------------- */}
        {tab === "swap" && (
          <div className="flex justify-center animate-fadeIn">
            <div className="card p-8 flex flex-col gap-6 max-w-md w-full">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <ArrowLeftRight className="w-6 h-6 text-[var(--color-hz-gold-deep)]" />
                  Instant Swap
                </h2>
                <p className="text-[var(--color-ink-2)] text-sm mt-1">Swap ETH, TERA and USDC through the Token Vendor.</p>
              </div>

              <form onSubmit={handleSwap} className="flex flex-col gap-4">
                <div className="z-40 relative">
                  <TokenSelector label="Token In" value={tokenA} onChange={setTokenA} placeholder="Select token" />
                </div>
                <div className="z-30 relative">
                  <TokenSelector label="Token Out" value={tokenB} onChange={setTokenB} placeholder="Select token" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-[var(--color-ink-3)] uppercase tracking-wider">
                    Amount in ({amountLabel})
                  </label>
                  <input
                    type="number"
                    value={swapAmountIn}
                    onChange={(e) => setSwapAmountIn(e.target.value)}
                    placeholder="100"
                    className="field"
                  />
                </div>
                <button type="submit" disabled={isSwapping} className="btn-gold w-full py-3.5 flex items-center justify-center gap-2">
                  {isSwapping && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSwapping ? "Swapping…" : "Execute Swap"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ---------------- AGENT ---------------- */}
        {tab === "agent" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-fadeIn">
            <div className="md:col-span-2 card p-8 flex flex-col gap-6 min-h-[500px] justify-between">
              <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-4">
                <div className="flex items-center gap-3">
                  <Cpu className="w-7 h-7 text-[var(--color-hz-gold-deep)]" />
                  <div>
                    <h2 className="text-xl font-bold">Horizen Trading Agent</h2>
                    <span className="text-xs text-[var(--color-hz-gold-deep)] font-semibold font-mono">POLICY SECURED</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      agentStatus === "thinking"
                        ? "bg-[var(--color-hz-gold-deep)] animate-ping"
                        : agentStatus === "done"
                        ? "bg-[var(--color-hz-green)]"
                        : agentStatus === "rejected"
                        ? "bg-[var(--color-hz-danger)]"
                        : "bg-[var(--color-ink-3)]"
                    }`}
                  />
                  <span className="text-xs text-[var(--color-ink-2)] font-mono capitalize">{agentStatus}</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto my-2 pr-1 flex flex-col gap-3 max-h-[300px]">
                {agentLogs.map((log, i) => (
                  <div
                    key={i}
                    className={`p-3.5 rounded-2xl max-w-[85%] text-sm whitespace-pre-line ${
                      log.type === "user"
                        ? "bg-[var(--color-hz-gold)]/20 self-end"
                        : log.type === "error"
                        ? "bg-[var(--color-hz-danger)]/10 text-[var(--color-hz-danger)] self-start"
                        : log.type === "system"
                        ? "bg-[var(--color-surface-2)] self-start"
                        : "bg-[var(--color-surface-2)] self-start"
                    }`}
                  >
                    {log.text}
                    {log.hash && (
                      <a
                        href={`${EXPLORER}/tx/${log.hash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 flex items-center gap-1 text-xs text-[var(--color-hz-blue)]"
                      >
                        View on explorer <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))}
                {agentStatus === "thinking" && (
                  <div className="bg-[var(--color-surface-2)] p-3.5 rounded-2xl max-w-[85%] self-start flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-[var(--color-hz-gold-deep)]" />
                    <span className="text-sm text-[var(--color-ink-2)] font-mono">Analysing policy and executing…</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <div className="z-40 relative">
                  <TokenSelector
                    label="Target token (context)"
                    value={agentSelectedToken}
                    onChange={(v) => {
                      setAgentSelectedToken(v);
                      setAgentInput((p) => (p ? `${p} ${v}` : v));
                    }}
                    placeholder="Select a token…"
                  />
                </div>
                <form onSubmit={handleAgentCommand} className="flex gap-2">
                  <input
                    value={agentInput}
                    onChange={(e) => setAgentInput(e.target.value)}
                    placeholder="e.g. Swap 10 ETH for TERA"
                    className="field flex-1"
                  />
                  <button type="submit" className="btn-navy px-5 flex items-center gap-1.5">
                    Send <ChevronRight className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </div>

            <div className="card p-8 flex flex-col items-center justify-center text-center gap-6">
              <h3 className="text-lg font-bold">Command Sphere</h3>
              <div className="relative my-2">
                <div
                  className={`absolute inset-0 rounded-full bg-[var(--color-hz-gold)]/40 blur-xl transition-all ${
                    agentStatus === "thinking" ? "scale-125 animate-pulse" : "scale-100"
                  }`}
                />
                <div className="w-32 h-32 rounded-full bg-[var(--color-hz-navy)] flex items-center justify-center relative z-10">
                  <Cpu className="w-14 h-14 text-[var(--color-hz-gold)]" />
                </div>
              </div>
              <div className="flex flex-col gap-3 w-full">
                <div className="flex items-start gap-2 text-xs text-left bg-[var(--color-surface-2)] border border-[var(--color-border)] p-3 rounded-xl">
                  <ShieldCheck className="w-6 h-6 text-[var(--color-hz-gold-deep)] flex-shrink-0" />
                  <div>
                    <span className="font-bold block">Spending guardrail</span>
                    <span className="text-[var(--color-ink-2)]">Max 100 ETH / 1000 tokens per trade.</span>
                  </div>
                </div>
                <div className="flex items-start gap-2 text-xs text-left bg-[var(--color-surface-2)] border border-[var(--color-border)] p-3 rounded-xl">
                  <CheckCircle2 className="w-6 h-6 text-[var(--color-hz-green)] flex-shrink-0" />
                  <div>
                    <span className="font-bold block">Verified allow-list</span>
                    <span className="text-[var(--color-ink-2)]">Only Trade Easy contracts on Horizen.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- FAUCET ---------------- */}
        {tab === "faucet" && (
          <div className="flex justify-center animate-fadeIn">
            <div className="card p-8 flex flex-col gap-6 max-w-md w-full text-center items-center">
              <div>
                <h2 className="text-2xl font-bold flex items-center justify-center gap-2">
                  <Droplets className="w-6 h-6 text-[var(--color-hz-gold-deep)]" />
                  TERA Daily Faucet
                </h2>
                <p className="text-[var(--color-ink-2)] text-sm mt-2">
                  Claim 100 TERA every 24 hours to test Trade Easy on Horizen.
                </p>
              </div>

              <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-2xl p-6 w-full flex flex-col gap-2">
                <span className="text-[11px] font-semibold text-[var(--color-ink-3)] uppercase tracking-wider">Next claim available</span>
                <span
                  className={`text-3xl font-mono font-bold ${
                    countdown === "Ready to claim" ? "text-[var(--color-hz-green)]" : "text-[var(--color-hz-navy)]"
                  }`}
                >
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

              <div className="w-full border-t border-[var(--color-border)] pt-4 flex flex-col gap-2 text-left">
                <span className="text-[11px] font-semibold text-[var(--color-ink-3)] uppercase tracking-wider">
                  Need gas? Horizen Testnet uses ETH
                </span>
                <a
                  href={TESTNET_HUB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between text-sm text-[var(--color-hz-navy)] hover:text-[var(--color-hz-gold-deep)] transition-colors"
                >
                  Bridge ETH via the Horizen hub
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <a
                  href={TESTNET_DOCS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between text-sm text-[var(--color-hz-navy)] hover:text-[var(--color-hz-gold-deep)] transition-colors"
                >
                  Add network &amp; RPC details
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- MINT ---------------- */}
        {tab === "mint" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fadeIn">
            <div className="card p-8 flex flex-col gap-6">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Coins className="w-6 h-6 text-[var(--color-hz-gold-deep)]" />
                  Deploy Token
                </h2>
                <p className="text-[var(--color-ink-2)] text-sm mt-1">Deploy a fungible token on Horizen via the token factory.</p>
              </div>

              <form onSubmit={handleMint} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-[var(--color-ink-3)] uppercase tracking-wider">Token name</label>
                  <input value={tokenName} onChange={(e) => setTokenName(e.target.value)} placeholder="e.g. Antigravity" className="field" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-[var(--color-ink-3)] uppercase tracking-wider">Token symbol</label>
                  <input value={tokenSymbol} onChange={(e) => setTokenSymbol(e.target.value)} placeholder="e.g. ANTI" className="field" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold text-[var(--color-ink-3)] uppercase tracking-wider">Decimals</label>
                    <input type="number" value={tokenDecimals} onChange={(e) => setTokenDecimals(e.target.value)} className="field" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold text-[var(--color-ink-3)] uppercase tracking-wider">Initial supply</label>
                    <input type="number" value={initialSupply} onChange={(e) => setInitialSupply(e.target.value)} placeholder="1000000" className="field" />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-[var(--color-ink-3)] uppercase tracking-wider">Creation fee (ETH)</label>
                  <input type="number" value={creationFee} onChange={(e) => setCreationFee(e.target.value)} placeholder="0" className="field" />
                </div>
                <button type="submit" disabled={mintingTx} className="btn-navy w-full py-3.5 flex items-center justify-center gap-2">
                  {mintingTx && <Loader2 className="w-4 h-4 animate-spin" />}
                  {mintingTx ? "Deploying…" : "Deploy Token"}
                </button>
              </form>
            </div>

            <div className="card p-8 flex flex-col gap-6">
              <div>
                <h3 className="text-xl font-bold">Your Deployed Tokens</h3>
                <p className="text-[var(--color-ink-2)] text-sm mt-1">Tokens you created through the factory.</p>
              </div>
              <div className="flex flex-col gap-3 overflow-y-auto max-h-[350px] pr-1">
                {userTokenList.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center border border-dashed border-[var(--color-border)] rounded-2xl">
                    <Coins className="w-8 h-8 text-[var(--color-ink-3)] mb-2" />
                    <p className="text-[var(--color-ink-3)] text-sm">No tokens created yet.</p>
                  </div>
                ) : (
                  userTokenList.map((t, i) => (
                    <div key={i} className="p-4 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl flex flex-col gap-1">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-[var(--color-hz-gold-deep)] font-mono uppercase font-bold">Token {i + 1}</span>
                        <a
                          href={`${EXPLORER}/token/${t}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[var(--color-ink-2)] hover:text-[var(--color-hz-navy)] flex items-center gap-1 text-[10px]"
                        >
                          Explorer <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <span className="text-sm font-mono select-all break-all">{t}</span>
                    </div>
                  ))
                )}
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
