"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useEffect, useState } from "react";
import { fetchHederaAccountId } from "@/utils/hedera";
import { Wallet } from "lucide-react";

export const CustomConnectButton = () => {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        authenticationStatus,
        mounted,
      }) => {
        const ready = mounted && authenticationStatus !== "loading";
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus || authenticationStatus === "authenticated");

        const [hederaId, setHederaId] = useState<string | null>(null);

        useEffect(() => {
          if (connected && account?.address) {
            fetchHederaAccountId(account.address).then((id) => {
              if (id) {
                setHederaId(id);
              }
            });
          } else {
            setHederaId(null);
          }
        }, [connected, account?.address]);

        return (
          <div
            {...(!ready && {
              "aria-hidden": true,
              style: {
                opacity: 0,
                pointerEvents: "none",
                userSelect: "none",
              },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <button
                    onClick={openConnectModal}
                    type="button"
                    className="bg-neon-teal text-black px-4 py-2 rounded-full font-semibold text-sm hover:shadow-[0_0_15px_rgba(45,212,191,0.5)] transition-all"
                  >
                    Connect Wallet
                  </button>
                );
              }

              if (chain.unsupported) {
                return (
                  <button
                    onClick={openChainModal}
                    type="button"
                    className="bg-red-500 text-white px-4 py-2 rounded-full font-semibold text-sm shadow-[0_0_15px_rgba(239,68,68,0.5)]"
                  >
                    Wrong network
                  </button>
                );
              }

              return (
                <div style={{ display: "flex", gap: 12 }}>
                  <button
                    onClick={openAccountModal}
                    type="button"
                    className="bg-black/40 border border-white/10 px-4 py-2 rounded-full text-white text-sm hover:border-neon-teal/50 transition-colors flex items-center gap-2"
                  >
                    <Wallet className="w-4 h-4 text-neon-teal" />
                    {hederaId || (account.address ? `${account.address.slice(0,6)}...${account.address.slice(-4)}` : "Loading...")}
                  </button>
                </div>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
};
