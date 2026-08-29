"use client";

import React from 'react';
import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig, RainbowKitProvider, lightTheme } from '@rainbow-me/rainbowkit';
import { metaMaskWallet, rainbowWallet, walletConnectWallet } from '@rainbow-me/rainbowkit/wallets';
import { WagmiProvider, http } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { defineChain } from 'viem';

// Horizen — EVM-native L3 on Base for private onchain finance. Gas token: ETH.
// Verify against https://chainlist.org/chain/845320009 before mainnet.
export const horizenTestnet = defineChain({
  id: 845320009,
  name: 'Horizen Testnet',
  network: 'horizen-testnet',
  nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
  rpcUrls: {
    default: { http: ['https://horizen-rpc-testnet.appchain.base.org'] },
    public: { http: ['https://horizen-rpc-testnet.appchain.base.org'] },
  },
  blockExplorers: {
    default: { name: 'Blockscout', url: 'https://horizen-explorer-testnet.appchain.base.org' },
  },
  testnet: true,
});

const config = getDefaultConfig({
  appName: 'Trade Easy',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '148d423984d72044810696b994464c9d',
  chains: [horizenTestnet],
  transports: {
    [horizenTestnet.id]: http(),
  },
  wallets: [
    {
      groupName: 'Recommended',
      wallets: [metaMaskWallet, rainbowWallet, walletConnectWallet],
    },
  ],
  ssr: true,
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={lightTheme({
            accentColor: '#fecb17',
            accentColorForeground: '#030e24',
            borderRadius: 'large',
            fontStack: 'system',
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
