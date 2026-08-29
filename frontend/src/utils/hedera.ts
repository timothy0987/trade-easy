/**
 * Legacy shim. Horizen is a plain EVM chain with no account-alias / mirror-node
 * lookup, so there is nothing to resolve — callers fall back to the raw address.
 * Kept only so existing imports keep resolving; delete once /profile is migrated.
 */
export const fetchX1AccountId = async (_evmAddress: string): Promise<string | null> => null;
