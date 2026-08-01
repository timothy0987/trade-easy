"use client";

import React, { useEffect, useState } from 'react';
import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig, RainbowKitProvider, darkTheme, getWalletConnectConnector } from '@rainbow-me/rainbowkit';
import { metaMaskWallet, rainbowWallet, walletConnectWallet } from '@rainbow-me/rainbowkit/wallets';
import { WagmiProvider, http } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { defineChain } from 'viem';

export const x1Testnet = defineChain({
  id: 204005, // Updated to Thirdweb X1 Testnet Chain ID
  name: 'X1 Network Testnet',
  network: 'x1-testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'XN',
    symbol: 'XN',
  },
  rpcUrls: {
    default: { http: ['https://x1-testnet.xen.network', 'https://204005.rpc.thirdweb.com'] }, 
    public: { http: ['https://x1-testnet.xen.network', 'https://204005.rpc.thirdweb.com'] },
  },
  blockExplorers: {
    default: { name: 'X1 Explorer', url: 'https://explorer.x1-testnet.xen.network' },
  },
});

const hashpackWallet = ({ projectId }: { projectId: string }) => ({
  id: 'hashpack',
  name: 'HashPack',
  iconUrl: 'https://www.hashpack.app/favicon.ico',
  iconBackground: '#0b1d3a',
  downloadUrls: {
    chrome: 'https://chrome.google.com/webstore/detail/hashpack/jggofhoiebckgbifbhahahbgedhcphfo',
    android: 'https://play.google.com/store/apps/details?id=app.hashpack.wallet',
    ios: 'https://apps.apple.com/us/app/hashpack-wallet/id1612848553',
  },
  createConnector: getWalletConnectConnector({
    projectId,
  }),
});

const config = getDefaultConfig({
  appName: 'Trade Easy',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '148d423984d72044810696b994464c9d',
  chains: [x1Testnet],
  transports: {
    [x1Testnet.id]: http(),
  },
  wallets: [
    {
      groupName: 'Recommended',
      wallets: [
        hashpackWallet,
        metaMaskWallet,
        rainbowWallet,
        walletConnectWallet,
      ],
    },
  ],
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Inject Buffer to window for Web3 wallet compatibility
    if (typeof window !== "undefined") {
      const { Buffer } = require("buffer");
      window.Buffer = window.Buffer || Buffer;
    }
  }, []);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider 
          theme={darkTheme({
            accentColor: '#a855f7',
            accentColorForeground: 'white',
            borderRadius: 'large',
            overlayBlur: 'large',
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
