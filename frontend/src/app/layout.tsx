import type { Metadata } from "next";
import { Providers } from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trade Easy | Horizen dApp & AI Trading Agent",
  description:
    "Swap assets, claim TERA from the faucet, and run guardrail-enforced AI trades on Horizen — the EVM-native L3 on Base for private onchain finance.",
  icons: {
    icon: "/Artboard_15_4x-100_1_-removebg-preview.png",
    apple: "/Artboard_15_4x-100_1_-removebg-preview.png",
  },
  openGraph: {
    images: [
      { url: "/Artboard_15_4x-100_1_-removebg-preview.png", width: 800, height: 600, alt: "Trade Easy" },
    ],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased bg-[var(--color-bg)] text-[var(--color-ink)] min-h-screen relative bg-grid">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
