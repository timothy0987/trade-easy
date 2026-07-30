export const fetchX1 EcoChainAccountId = async (evmAddress: string): Promise<string | null> => {
  try {
    const res = await fetch(`https://testnet.mirrornode.x1ecochain.com/api/v1/accounts/${evmAddress}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.account || null;
  } catch (err) {
    console.error("Failed to fetch X1 EcoChain Account ID:", err);
    return null;
  }
};
