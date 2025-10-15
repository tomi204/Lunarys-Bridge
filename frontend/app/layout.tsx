import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppKit } from "./reown";
import { ReownEthersSignerProvider } from "@/hooks/useReownEthersSigner";
import { SolanaWalletProvider } from "@/hooks/useReownSolanaWallet";
import { FhevmBridgeProvider } from "@/providers/fhevm-bridge-provider";
import { Toaster } from 'sonner';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://lunarys.io"),
  title: {
    default: "Lunarys | Encrypted Cross-Chain Bridge",
    template: "%s | Lunarys",
  },
  icons: {
    icon: [
      //{ url: "/favicon.ico" },
      { url: "/iso-logo.svg", sizes: "32x32", type: "image/svg" },
    ]
  },
  description:
    "Lunarys delivers zero-knowledge encrypted cross-chain transfers with Raydium liquidity, Triton latency, and programmable compliance controls.",
  openGraph: {
    title: "Lunarys | Encrypted Cross-Chain Bridge",
    description:
      "Bridge assets privately and instantly with zero-knowledge proofs, deep liquidity, and institutional policy packs.",
    url: "https://lunarys.io",
    siteName: "Lunarys",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lunarys | Encrypted Cross-Chain Bridge",
    description:
      "Encrypted cross-chain routing with sub-second settlement, programmable compliance, and hardware-attested proofs.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#020617] text-white`}
      >
        <AppKit>
          <ReownEthersSignerProvider>
            <SolanaWalletProvider>
              <FhevmBridgeProvider>
                {children}
                <Toaster richColors position="top-center" />
              </FhevmBridgeProvider>
            </SolanaWalletProvider>
          </ReownEthersSignerProvider>
        </AppKit>
      </body>
    </html>
  );
}
