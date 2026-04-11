import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { WalletProvider } from "./context/WalletContext";
import "./globals.css";



export const metadata: Metadata = {
  title: "StellarPredict — Decentralized Prediction Markets",
  description:
    "Trade on real-world events using Stellar Soroban smart contracts. Earn rewards by predicting outcomes with on-chain AMM mechanics.",
  keywords: "prediction market, stellar, soroban, amm, crypto, defi",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased font-sans" suppressHydrationWarning style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}


