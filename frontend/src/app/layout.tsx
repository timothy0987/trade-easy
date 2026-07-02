import type { Metadata } from "next";
import { Providers } from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trade Easy | Hedera dApp & AI Trading Agent",
  description: "Mint custom HTS tokens, swap assets instantly via constant product AMM pools, and run guardrail-enforced AI trades on Hedera TestNet.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased bg-void text-gray-100 min-h-screen relative bg-grid">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
