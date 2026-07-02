"use client";

import React, { useEffect, useState } from 'react';
import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig, RainbowKitProvider, darkTheme, getWalletConnectConnector } from '@rainbow-me/rainbowkit';
import { metaMaskWallet, rainbowWallet, walletConnectWallet } from '@rainbow-me/rainbowkit/wallets';
import { WagmiProvider, http } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const hederaTestnet = {
  id: 296,
  name: 'Hedera Testnet',
  network: 'hedera-testnet',
  nativeCurrency: { decimals: 18, name: 'HBAR', symbol: 'HBAR' },
  rpcUrls: {
    default: { http: ['https://testnet.hashio.io/api'] },
    public: { http: ['https://testnet.hashio.io/api'] },
  },
  blockExplorers: {
    default: { name: 'HashScan', url: 'https://hashscan.io/testnet' },
  },
  testnet: true,
};

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
  chains: [hederaTestnet],
  transports: {
    [hederaTestnet.id]: http(),
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
