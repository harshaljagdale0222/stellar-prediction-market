import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { WalletProvider } from "./context/WalletContext";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "StellarPredict — Decentralized Prediction Markets",
  description:
    "Trade on real-world events using Stellar Soroban smart contracts. Earn rewards by predicting outcomes with on-chain AMM mechanics.",
  keywords: "prediction market, stellar, soroban, amm, crypto, defi",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="antialiased font-sans" suppressHydrationWarning>
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
