import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ethers } from "ethers";
import addresses from "@/contracts/addresses.json";
import PrivateTradingVaultAbi from "@/contracts/PrivateTradingVault.json";

/**
 * Manager control surface for the Private Trading Vault.
 *
 * This is the human manager's console — NOT the autonomous agent (which runs in the
 * Vela TEE and trades on its own). It turns natural-language supervisory commands into
 * vault calls and mirrors the on-chain mandate client-side so bad commands are rejected
 * before they cost gas.
 *
 * Response: { status, message, txHash?, policyViolation?, parsedAction? }
 *   status: "SUCCESS" | "REJECTED" | "SIMULATED" | "ERROR" | "UNKNOWN"
 */

const A = addresses as Record<string, string>;
const apiKey = process.env.GEMINI_API_KEY;
const aiClient = apiKey ? new GoogleGenerativeAI(apiKey) : null;
const PROVIDER_URL = process.env.HORIZEN_RPC_URL || "https://horizen-rpc-testnet.appchain.base.org";

const POLICY = { MAX_TRADE_BPS: 2000 }; // mirror of PrivateTradingVault.maxTradeBps

type Action = "trade" | "pause" | "unpause" | "process_redemptions" | "status" | "unknown";
interface ParsedAction {
  action: Action;
  params: { tokenIn?: string; tokenOut?: string; amountIn?: string; minAmountOut?: string; requestIds?: number[] };
}

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();
    if (!prompt) return NextResponse.json({ error: "Prompt is required" }, { status: 400 });

    const parsed = aiClient ? await parseWithGemini(prompt) : fallbackParse(prompt);

    const vaultAddress = A.PrivateTradingVault;
    const adapterAddress = A.TradeEasyVenueAdapter;
    if (!vaultAddress) {
      return NextResponse.json({ status: "ERROR", message: "Vault not deployed. Run `npm run deploy:vault` in /contracts." });
    }
    if (parsed.action === "unknown") {
      return NextResponse.json({
        status: "UNKNOWN",
        message: "Try: 'status', 'pause the vault', 'settle redemptions 0,1', or 'trade 1500 <tokenIn> into <tokenOut> min 0'.",
      });
    }

    const provider = new ethers.JsonRpcProvider(PROVIDER_URL);
    const vaultRead = new ethers.Contract(vaultAddress, PrivateTradingVaultAbi, provider);

    if (parsed.action === "status") {
      const [nav, pps, unwindOnly, paused] = await Promise.all([
        vaultRead.totalAssets(),
        vaultRead.pricePerShare(),
        vaultRead.unwindOnly(),
        vaultRead.paused(),
      ]);
      return NextResponse.json({
        status: "SUCCESS",
        message: `NAV ${ethers.formatEther(nav)} | price/share ${ethers.formatEther(pps)} | unwindOnly ${unwindOnly} | paused ${paused}`,
      });
    }

    if (parsed.action === "trade") {
      const { tokenIn, tokenOut, amountIn } = parsed.params;
      if (!tokenIn || !tokenOut || !amountIn) {
        return NextResponse.json({ status: "ERROR", message: "trade needs tokenIn, tokenOut and amountIn" });
      }
      const nav: bigint = await vaultRead.totalAssets();
      const amountInWei = ethers.parseEther(amountIn);
      const cap = (nav * BigInt(POLICY.MAX_TRADE_BPS)) / 10_000n;
      if (nav > 0n && amountInWei > cap) {
        return NextResponse.json({
          status: "REJECTED",
          policyViolation: "TRADE_TOO_LARGE",
          message: `Trade ${amountIn} exceeds ${POLICY.MAX_TRADE_BPS / 100}% of NAV (${ethers.formatEther(cap)}).`,
        });
      }
    }

    const privateKey = process.env.AGENT_PRIVATE_KEY || process.env.PRIVATE_KEY;
    if (!privateKey) {
      return NextResponse.json({
        status: "SIMULATED",
        parsedAction: parsed,
        message: "No agent key on server. Mandate checks passed; transaction would execute.",
      });
    }

    const wallet = new ethers.Wallet(privateKey, provider);
    const vault = new ethers.Contract(vaultAddress, PrivateTradingVaultAbi, wallet);

    if (parsed.action === "pause") {
      const rcpt = await (await vault.pause()).wait();
      return NextResponse.json({ status: "SUCCESS", txHash: rcpt.hash, message: "Vault paused." });
    }
    if (parsed.action === "unpause") {
      const rcpt = await (await vault.unpause()).wait();
      return NextResponse.json({ status: "SUCCESS", txHash: rcpt.hash, message: "Vault unpaused." });
    }
    if (parsed.action === "process_redemptions") {
      const ids = parsed.params.requestIds ?? [];
      const rcpt = await (await vault.processRedeemRequests(ids)).wait();
      return NextResponse.json({ status: "SUCCESS", txHash: rcpt.hash, message: `Processed redemption requests [${ids.join(", ")}].` });
    }
    if (parsed.action === "trade") {
      const { tokenIn, tokenOut, amountIn, minAmountOut } = parsed.params;
      const strategyTag = ethers.id("manual:manager-console");
      const rcpt = await (
        await vault.executeTrade(
          adapterAddress,
          tokenIn,
          tokenOut,
          ethers.parseEther(amountIn!),
          ethers.parseEther(minAmountOut ?? "0"),
          strategyTag,
          "0x"
        )
      ).wait();
      return NextResponse.json({ status: "SUCCESS", txHash: rcpt.hash, message: `Executed trade ${amountIn} ${tokenIn} → ${tokenOut}.` });
    }

    return NextResponse.json({ status: "UNKNOWN", message: "Command not recognized." });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("Vault console error:", error);
    return NextResponse.json({ status: "ERROR", message }, { status: 500 });
  }
}

async function parseWithGemini(prompt: string): Promise<ParsedAction> {
  try {
    const model = aiClient!.getGenerativeModel({ model: "gemini-1.5-flash" });
    const system = `You parse a vault manager's command into JSON.
action: "trade" | "pause" | "unpause" | "process_redemptions" | "status" | "unknown"
params: { tokenIn?, tokenOut? (addresses or symbols), amountIn?, minAmountOut? (decimal strings), requestIds? (number[]) }
Return ONLY JSON, no markdown.
"pause the vault" -> {"action":"pause","params":{}}
"status" -> {"action":"status","params":{}}
"settle redemptions 0,1,2" -> {"action":"process_redemptions","params":{"requestIds":[0,1,2]}}
"trade 5000 vUSD into mWETH min 2" -> {"action":"trade","params":{"tokenIn":"vUSD","tokenOut":"mWETH","amountIn":"5000","minAmountOut":"2"}}`;
    const result = await model.generateContent([system, prompt]);
    const text = result.response.text().replace(/```json|```/g, "").trim();
    return JSON.parse(text) as ParsedAction;
  } catch (err) {
    console.error("Gemini parse failed, using rule-based parser:", err);
    return fallbackParse(prompt);
  }
}

function fallbackParse(prompt: string): ParsedAction {
  const p = prompt.toLowerCase();
  if (p.includes("status")) return { action: "status", params: {} };
  if (p.includes("unpause") || p.includes("resume")) return { action: "unpause", params: {} };
  if (p.includes("pause") || p.includes("halt")) return { action: "pause", params: {} };
  if (p.includes("redemption") || p.includes("redeem") || p.includes("settle")) {
    return { action: "process_redemptions", params: { requestIds: [...p.matchAll(/\d+/g)].map((m) => parseInt(m[0], 10)) } };
  }
  if (p.includes("trade") || p.includes("swap")) {
    const addrs = p.match(/0x[a-f0-9]{40}/gi) || [];
    return {
      action: "trade",
      params: { amountIn: p.match(/([\d.]+)/)?.[1], tokenIn: addrs[0], tokenOut: addrs[1] },
    };
  }
  return { action: "unknown", params: {} };
}
