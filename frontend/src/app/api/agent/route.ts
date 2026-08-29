import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ethers } from "ethers";
import addresses from "@/contracts/addresses.json";
import TokenCreatorAbi from "@/contracts/TokenCreator.json";
import TradeEasyRouterAbi from "@/contracts/TradeEasyRouter.json";

const A = addresses as Record<string, string>;

const apiKey = process.env.GEMINI_API_KEY;
const aiClient = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Guardrails (native gas token on Horizen is ETH)
const SPENDING_LIMITS = { ETH: 100, DEFAULT_TOKEN: 1000 };

const ALLOWED_CONTRACTS = [
  A.TokenCreator?.toLowerCase(),
  A.TradeEasyFactory?.toLowerCase(),
  A.TradeEasyRouter?.toLowerCase(),
  A.TokenVendor?.toLowerCase(),
].filter(Boolean);

const PROVIDER_URL =
  process.env.HORIZEN_RPC_URL || "https://horizen-rpc-testnet.appchain.base.org";

type Parsed = {
  action: "mint" | "swap" | "balance" | "unknown";
  params: { amount?: number; tokenAddress?: string; tokenIn?: string; tokenOut?: string };
};

export async function POST(req: NextRequest) {
  try {
    const { prompt, userAddress } = await req.json();
    if (!prompt) return NextResponse.json({ error: "Prompt is required" }, { status: 400 });

    const parsed = aiClient ? await parseWithGemini(prompt) : fallbackParse(prompt);
    console.log("Parsed action:", parsed);

    // --- Guardrail 1: spending limit ---
    if (parsed.action === "mint" || parsed.action === "swap") {
      const amount = parsed.params.amount || 0;
      const isNative = parsed.params.tokenIn === "ETH" || parsed.params.tokenOut === "ETH";
      const limit = isNative ? SPENDING_LIMITS.ETH : SPENDING_LIMITS.DEFAULT_TOKEN;
      if (amount > limit) {
        return NextResponse.json({
          status: "REJECTED",
          policyViolation: "SPENDING_LIMIT_EXCEEDED",
          message: `Command requests ${amount}, over the ${limit} per-transaction limit.`,
        });
      }
    }

    // --- Guardrail 2: contract allow-list ---
    if (parsed.action === "mint" && !ALLOWED_CONTRACTS.includes(A.TokenCreator?.toLowerCase())) {
      return NextResponse.json({
        status: "REJECTED",
        policyViolation: "UNAUTHORIZED_CONTRACT",
        message: "Token factory is not in the allow-list.",
      });
    }
    if (parsed.action === "swap" && !ALLOWED_CONTRACTS.includes(A.TradeEasyRouter?.toLowerCase())) {
      return NextResponse.json({
        status: "REJECTED",
        policyViolation: "UNAUTHORIZED_CONTRACT",
        message: "Swap router is not in the allow-list.",
      });
    }

    // --- TERA holder fee discount ---
    let actualFee = 2;
    let hasTera = false;
    if (userAddress && A.TERA) {
      try {
        const provider = new ethers.JsonRpcProvider(PROVIDER_URL);
        const tera = new ethers.Contract(A.TERA, ["function balanceOf(address) view returns (uint256)"], provider);
        if ((await tera.balanceOf(userAddress)) > 0n) {
          hasTera = true;
          actualFee = 1;
        }
      } catch (err) {
        console.error("TERA balance check failed:", err);
      }
    }
    const feeNote = hasTera
      ? `\n\n[TERA holder discount: 50% off — fee ${actualFee} ETH (standard 2 ETH)]`
      : `\n\n[Fee: 2 ETH — hold TERA for 50% off]`;

    // --- Execute ---
    const privateKey = process.env.AGENT_PRIVATE_KEY || process.env.PRIVATE_KEY;
    if (!privateKey) {
      return NextResponse.json({
        status: "SIMULATED",
        parsedAction: parsed,
        message: `No agent key on server. Guardrails passed; transaction would execute.${feeNote}`,
      });
    }

    const provider = new ethers.JsonRpcProvider(PROVIDER_URL);
    const wallet = new ethers.Wallet(privateKey, provider);

    if (parsed.action === "balance") {
      const bal = ethers.formatEther(await provider.getBalance(wallet.address));
      return NextResponse.json({
        status: "SUCCESS",
        message: `Agent wallet ${wallet.address} holds ${bal} ETH.`,
      });
    }

    if (parsed.action === "mint") {
      const { amount = 0, tokenAddress } = parsed.params;
      if (!tokenAddress) return NextResponse.json({ status: "ERROR", message: "Token address required for minting." });
      const c = new ethers.Contract(A.TokenCreator, TokenCreatorAbi, wallet);
      const receipt = await (await c.mintAdditional(tokenAddress, amount, { gasLimit: 1_000_000 })).wait();
      return NextResponse.json({
        status: "SUCCESS",
        txHash: receipt.hash,
        message: `Minted ${amount} of ${tokenAddress}.${feeNote}`,
      });
    }

    if (parsed.action === "swap") {
      const { amount = 0, tokenIn, tokenOut } = parsed.params;
      if (!tokenIn || !tokenOut) return NextResponse.json({ status: "ERROR", message: "tokenIn and tokenOut required for swap." });
      const router = new ethers.Contract(A.TradeEasyRouter, TradeEasyRouterAbi, wallet);
      const value = ethers.parseEther(String(amount));
      if (tokenIn !== "ETH") {
        const t = new ethers.Contract(tokenIn, ["function approve(address,uint256) returns (bool)"], wallet);
        await (await t.approve(A.TradeEasyRouter, value)).wait();
      }
      const deadline = Math.floor(Date.now() / 1000) + 600;
      const receipt = await (
        await router.swapExactTokensForTokens(value, 0, [tokenIn, tokenOut], wallet.address, deadline, { gasLimit: 2_000_000 })
      ).wait();
      return NextResponse.json({
        status: "SUCCESS",
        txHash: receipt.hash,
        message: `Swapped ${amount} ${tokenIn} → ${tokenOut}.${feeNote}`,
      });
    }

    return NextResponse.json({ status: "UNKNOWN", message: "Try 'mint …', 'swap A for B', or 'check balance'." });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("Agent error:", error);
    return NextResponse.json({ status: "ERROR", message }, { status: 500 });
  }
}

async function parseWithGemini(prompt: string): Promise<Parsed> {
  try {
    const model = aiClient!.getGenerativeModel({ model: "gemini-1.5-flash" });
    const system = `You parse commands for Trade Easy, a Web3 AI agent on Horizen Testnet.
Return ONLY JSON: { "action": "mint"|"swap"|"balance"|"unknown", "params": { amount?, tokenAddress?, tokenIn?, tokenOut? } }
Native gas token is "ETH". Project token is "TERA".
"Swap 10 ETH for TERA" -> {"action":"swap","params":{"amount":10,"tokenIn":"ETH","tokenOut":"TERA"}}
"Mint 500 of 0xabc..." -> {"action":"mint","params":{"amount":500,"tokenAddress":"0xabc..."}}
"What is my balance?" -> {"action":"balance","params":{}}
No markdown, no backticks.`;
    const result = await model.generateContent([system, prompt]);
    const text = result.response.text().replace(/```json|```/g, "").trim();
    return JSON.parse(text) as Parsed;
  } catch (err) {
    console.error("Gemini parse failed, using rule-based parser:", err);
    return fallbackParse(prompt);
  }
}

function fallbackParse(prompt: string): Parsed {
  const p = prompt.toLowerCase();
  if (p.includes("balance")) return { action: "balance", params: {} };
  if (p.includes("mint")) {
    return {
      action: "mint",
      params: {
        amount: Number(p.match(/mint\s+(\d+)/)?.[1] ?? 0),
        tokenAddress: p.match(/0x[a-f0-9]{40}/i)?.[0],
      },
    };
  }
  if (p.includes("swap")) {
    const addrs = p.match(/0x[a-f0-9]{40}/gi) || [];
    return {
      action: "swap",
      params: {
        amount: Number(p.match(/swap\s+(\d+)/)?.[1] ?? 0),
        tokenIn: addrs[0],
        tokenOut: addrs[1],
      },
    };
  }
  return { action: "unknown", params: {} };
}
