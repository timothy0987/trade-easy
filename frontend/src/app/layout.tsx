import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/Providers";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export const metadata: Metadata = {
  title: "Private Trading Vault | Horizen",
  description:
    "A pooled vault on Horizen where an autonomous agent trades inside a TEE — strategy and positions stay confidential, solvency stays verifiable.",
  openGraph: {
    title: "Private Trading Vault | Horizen",
    description:
      "A pooled vault on Horizen where an autonomous agent trades inside a TEE — strategy and positions stay confidential, solvency stays verifiable.",
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
