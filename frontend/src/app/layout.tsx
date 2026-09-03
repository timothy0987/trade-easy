import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/Providers";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

const SITE_URL = "https://www.trade-easy.xyz";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Private Trading Vault | Horizen",
  description:
    "A pooled vault on Horizen where an autonomous agent trades inside a TEE — strategy and positions stay confidential, solvency stays verifiable.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Private Trading Vault",
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
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&family=Spectral:wght@600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased bg-[var(--color-bg)] text-[var(--color-ink)] min-h-screen relative bg-grid">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
