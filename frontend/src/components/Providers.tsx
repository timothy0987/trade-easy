"use client";

import React from 'react';
import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig, RainbowKitProvider, lightTheme } from '@rainbow-me/rainbowkit';
import { metaMaskWallet, rainbowWallet, walletConnectWallet } from '@rainbow-me/rainbowkit/wallets';
import { WagmiProvider, http } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { defineChain } from 'viem';

// Horizen Testnet — runs on Base Sepolia. Gas token: ETH.
// Params per https://horizen-2-docs.horizen.io/horizen-chain/network/testnet
export const horizenTestnet = defineChain({
  id: 2651420,
  name: 'Horizen Testnet',
  network: 'horizen-testnet',
  nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
  rpcUrls: {
    default: { http: ['https://horizen-testnet.rpc.caldera.xyz/http'] },
    public: { http: ['https://horizen-testnet.rpc.caldera.xyz/http'] },
  },
  blockExplorers: {
    default: { name: 'Horizen Explorer', url: 'https://explorer-testnet.horizen.io' },
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
