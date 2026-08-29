"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Wallet } from "lucide-react";

export const CustomConnectButton = () => {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, authenticationStatus, mounted }) => {
        const ready = mounted && authenticationStatus !== "loading";
        const connected =
          ready && account && chain && (!authenticationStatus || authenticationStatus === "authenticated");

        return (
          <div
            {...(!ready && {
              "aria-hidden": true,
              style: { opacity: 0, pointerEvents: "none", userSelect: "none" },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <button onClick={openConnectModal} type="button" className="btn-gold px-4 py-2 text-sm rounded-full">
                    Connect Wallet
                  </button>
                );
              }

              if (chain.unsupported) {
                return (
                  <button
                    onClick={openChainModal}
                    type="button"
                    className="px-4 py-2 rounded-full font-semibold text-sm text-white"
                    style={{ background: "var(--color-hz-danger)" }}
                  >
                    Wrong network
                  </button>
                );
              }

              return (
                <button
                  onClick={openAccountModal}
                  type="button"
                  className="bg-[var(--color-surface-2)] border border-[var(--color-border)] px-4 py-2 rounded-full text-[var(--color-ink)] text-sm hover:border-[var(--color-hz-gold-deep)] transition-colors flex items-center gap-2"
                >
                  <Wallet className="w-4 h-4 text-[var(--color-hz-gold-deep)]" />
                  {account.address ? `${account.address.slice(0, 6)}…${account.address.slice(-4)}` : "Loading…"}
                </button>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
};
