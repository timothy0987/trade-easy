export const fetchHederaAccountId = async (evmAddress: string): Promise<string | null> => {
  try {
    const res = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/accounts/${evmAddress}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.account || null;
  } catch (err) {
    console.error("Failed to fetch Hedera Account ID:", err);
    return null;
  }
};
