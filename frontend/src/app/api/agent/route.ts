import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ethers } from "ethers";
import addresses from "@/contracts/addresses.json";
import TokenCreatorAbi from "@/contracts/TokenCreator.json";
import TradeEasyRouterAbi from "@/contracts/TradeEasyRouter.json";

// Initialize the Google Generative AI client if the key is available
const apiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenerativeAI | null = null;
if (apiKey) {
  aiClient = new GoogleGenerativeAI(apiKey);
}

// Configured Guardrails
const POLICY_SPENDING_LIMITS = {
  HBAR: 100, // Max 100 HBAR per trade
  DEFAULT_TOKEN: 1000, // Max 1000 custom tokens per trade
};

const ALLOWED_CONTRACTS = [
  addresses.TokenCreator.toLowerCase(),
  addresses.TradeEasyFactory.toLowerCase(),
  addresses.TradeEasyRouter.toLowerCase()
];

// RPC setup
const PROVIDER_URL = "https://testnet.hashio.io/api";

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();
    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    let parsedAction: {
      action: "mint" | "swap" | "balance" | "unknown";
      params: {
        amount?: number;
        tokenAddress?: string;
        tokenIn?: string;
        tokenOut?: string;
      };
    };

    if (aiClient) {
      try {
        const model = aiClient.getGenerativeModel({ model: "gemini-1.5-flash" });
        const systemPrompt = `You are the parsing module for Trade Easy, a Web3 AI Agent on Hedera Testnet.
Parse the user's natural language command into a JSON object containing:
- action: "mint" | "swap" | "balance" | "unknown"
- params: an object containing:
  - amount: number (the amount to swap or mint)
  - tokenAddress: string (the address of the token to mint or swap, if present)
  - tokenIn: string (symbol or address, e.g. "TE" or "HBAR")
  - tokenOut: string (symbol or address, e.g. "TE" or "HBAR")

Examples:
User: "Mint 500 of token 0x17ac1C0fc9A33c43550A79ED1631c17e134212E3"
Response: {"action": "mint", "params": {"amount": 500, "tokenAddress": "0x17ac1C0fc9A33c43550A79ED1631c17e134212E3"}}

User: "Swap 10 HBAR for token 0x17ac1C0fc9A33c43550A79ED1631c17e134212E3"
Response: {"action": "swap", "params": {"amount": 10, "tokenIn": "HBAR", "tokenOut": "0x17ac1C0fc9A33c43550A79ED1631c17e134212E3"}}

User: "What is my agent balance?"
Response: {"action": "balance", "params": {}}

Only return valid JSON. Do not include markdown formatting, backticks, or explanations.`;

        const result = await model.generateContent([systemPrompt, prompt]);
        const text = result.response.text().trim();
        console.log("Raw Gemini Response:", text);
        
        // Clean JSON formatting if Gemini included markdown wraps
        const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();
        parsedAction = JSON.parse(cleanText);
      } catch (err) {
        console.error("Gemini parse failed, falling back to rule-based parser:", err);
        parsedAction = fallbackParse(prompt);
      }
    } else {
      console.log("Gemini API Key missing, using rule-based parser.");
      parsedAction = fallbackParse(prompt);
    }

    console.log("Parsed Action:", parsedAction);

    // --- ENFORCE SECURITY GUARDRAILS ---
    
    // 1. Check Spending Limit Policy
    if (parsedAction.action === "mint" || parsedAction.action === "swap") {
      const amount = parsedAction.params.amount || 0;
      const isHbar = parsedAction.params.tokenIn === "HBAR" || parsedAction.params.tokenOut === "HBAR";
      const limit = isHbar ? POLICY_SPENDING_LIMITS.HBAR : POLICY_SPENDING_LIMITS.DEFAULT_TOKEN;
      
      if (amount > limit) {
        return NextResponse.json({
          status: "REJECTED",
          policyViolation: "SPENDING_LIMIT_EXCEEDED",
          message: `Policy violation: Command requests ${amount} which exceeds the maximum allowed limit of ${limit} per transaction.`
        });
      }
    }

    // 2. Check Allow-list Policy (contracts)
    if (parsedAction.action === "mint" && parsedAction.params.tokenAddress) {
      // If minting, we must ensure we only call mint on contracts that are allowed (i.e. our TokenCreator)
      const target = addresses.TokenCreator.toLowerCase();
      if (!ALLOWED_CONTRACTS.includes(target)) {
        return NextResponse.json({
          status: "REJECTED",
          policyViolation: "UNAUTHORIZED_CONTRACT",
          message: `Policy violation: Target contract ${target} is not in the allowed contracts list.`
        });
      }
    }

    if (parsedAction.action === "swap") {
      // Swap must go through our TradeEasyRouter
      const target = addresses.TradeEasyRouter.toLowerCase();
      if (!ALLOWED_CONTRACTS.includes(target)) {
        return NextResponse.json({
          status: "REJECTED",
          policyViolation: "UNAUTHORIZED_CONTRACT",
          message: `Policy violation: Target swap router ${target} is not in the allowed contracts list.`
        });
      }
    }

    // --- EXECUTE ON-CHAIN TRANSACTIONS ---
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      return NextResponse.json({
        status: "SIMULATED",
        parsedAction,
        message: "No private key configured on server. Guardrails passed. Transaction would execute successfully."
      });
    }

    const provider = new ethers.JsonRpcProvider(PROVIDER_URL);
    const wallet = new ethers.Wallet(privateKey, provider);

    if (parsedAction.action === "balance") {
      const balanceWei = await provider.getBalance(wallet.address);
      const balanceHbar = ethers.formatEther(balanceWei);
      return NextResponse.json({
        status: "SUCCESS",
        action: "balance",
        agentAddress: wallet.address,
        balance: balanceHbar,
        message: `Agent wallet address is ${wallet.address} with a balance of ${balanceHbar} HBAR.`
      });
    }

    if (parsedAction.action === "mint") {
      const amount = parsedAction.params.amount || 0;
      const tokenAddress = parsedAction.params.tokenAddress;

      if (!tokenAddress) {
        return NextResponse.json({ status: "ERROR", message: "Token address is required for minting" });
      }

      console.log(`Executing mint of ${amount} for token ${tokenAddress} using Agent Hot Wallet`);
      const tokenCreatorContract = new ethers.Contract(addresses.TokenCreator, TokenCreatorAbi, wallet);
      
      const tx = await tokenCreatorContract.mintAdditional(tokenAddress, amount, {
        gasLimit: 1000000
      });
      const receipt = await tx.wait();

      return NextResponse.json({
        status: "SUCCESS",
        action: "mint",
        txHash: receipt.hash,
        message: `Successfully minted ${amount} tokens to HTS Token ${tokenAddress}. Tx Hash: ${receipt.hash}`
      });
    }

    if (parsedAction.action === "swap") {
      const amount = parsedAction.params.amount || 0;
      const tokenIn = parsedAction.params.tokenIn;
      const tokenOut = parsedAction.params.tokenOut;

      if (!tokenIn || !tokenOut) {
        return NextResponse.json({ status: "ERROR", message: "tokenIn and tokenOut addresses are required for swap" });
      }

      console.log(`Executing swap of ${amount} ${tokenIn} -> ${tokenOut}`);
      
      // Call Router swapExactTokensForTokens
      // We will perform a simple approval first if it's not HBAR
      const routerContract = new ethers.Contract(addresses.TradeEasyRouter, TradeEasyRouterAbi, wallet);
      
      // Let's execute approval for tokenIn
      const tokenInContract = new ethers.Contract(tokenIn, [
        "function approve(address spender, uint256 amount) public returns (bool)"
      ], wallet);
      
      const parsedAmount = ethers.parseEther(amount.toString());
      console.log("Approving router...");
      const approveTx = await tokenInContract.approve(addresses.TradeEasyRouter, parsedAmount);
      await approveTx.wait();
      console.log("Approved! Executing swap...");

      const path = [tokenIn, tokenOut];
      const deadline = Math.floor(Date.now() / 1000) + 600; // 10 minutes

      const tx = await routerContract.swapExactTokensForTokens(
        parsedAmount,
        0, // Accept any output amount for agent demo
        path,
        wallet.address,
        deadline,
        {
          gasLimit: 2000000
        }
      );
      const receipt = await tx.wait();

      return NextResponse.json({
        status: "SUCCESS",
        action: "swap",
        txHash: receipt.hash,
        message: `Successfully swapped ${amount} of ${tokenIn} for ${tokenOut}. Tx Hash: ${receipt.hash}`
      });
    }

    return NextResponse.json({
      status: "UNKNOWN",
      message: "Command was not recognized. Please try 'mint X tokens of type Y' or 'swap A for B' or 'check balance'."
    });

  } catch (error: any) {
    console.error("Agent execution error:", error);
    return NextResponse.json({ status: "ERROR", message: error.message || "Internal server error" }, { status: 500 });
  }
}

// Fallback rule-based parser in case Gemini is offline or not configured
function fallbackParse(prompt: string) {
  const cleanPrompt = prompt.toLowerCase();
  
  if (cleanPrompt.includes("balance") || cleanPrompt.includes("how much hbar")) {
    return { action: "balance" as const, params: {} };
  }
  
  if (cleanPrompt.includes("mint")) {
    const amountMatch = cleanPrompt.match(/mint\s+(\d+)/);
    const addressMatch = cleanPrompt.match(/0x[a-f0-9]{40}/i);
    return {
      action: "mint" as const,
      params: {
        amount: amountMatch ? parseInt(amountMatch[1]) : 0,
        tokenAddress: addressMatch ? addressMatch[0] : undefined
      }
    };
  }
  
  if (cleanPrompt.includes("swap")) {
    const amountMatch = cleanPrompt.match(/swap\s+(\d+)/);
    const addressesMatch = cleanPrompt.match(/0x[a-f0-9]{40}/gi);
    return {
      action: "swap" as const,
      params: {
        amount: amountMatch ? parseInt(amountMatch[1]) : 0,
        tokenIn: addressesMatch && addressesMatch[0] ? addressesMatch[0] : undefined,
        tokenOut: addressesMatch && addressesMatch[1] ? addressesMatch[1] : undefined
      }
    };
  }

  return { action: "unknown" as const, params: {} };
}
