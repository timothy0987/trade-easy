"use client";

import React, { useEffect, useState } from 'react';
import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig, RainbowKitProvider, darkTheme, getWalletConnectConnector } from '@rainbow-me/rainbowkit';
import { metaMaskWallet, rainbowWallet, walletConnectWallet } from '@rainbow-me/rainbowkit/wallets';
import { WagmiProvider, http } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { defineChain } from 'viem';

export const xLayerTestnet = defineChain({
  id: 1952,
  name: 'X Layer Testnet',
  network: 'xlayer-testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'OKB', 
    symbol: 'OKB',
  },
  rpcUrls: {
    default: { http: ['https://testrpc.xlayer.tech'] }, 
    public: { http: ['https://testrpc.xlayer.tech'] },
  },
  blockExplorers: {
    default: { name: 'OKX Explorer', url: 'https://www.okx.com/web3/explorer/xlayer-test' },
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
  chains: [xLayerTestnet],
  transports: {
    [xLayerTestnet.id]: http(),
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
