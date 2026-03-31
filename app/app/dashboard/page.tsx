"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatCurrency, shortenAddress } from "@/lib/stellar";
import { useWallet } from "@/app/context/WalletContext";
import WalletModal from "@/app/components/WalletModal";

function DashboardNavbar({ address, onOpenModal }: { address: string | null; onOpenModal: () => void }) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/5">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center text-sm font-bold">
            ⭐
          </div>
          <span className="font-bold text-lg tracking-tight gradient-text">StellarPredict</span>
        </Link>
        <div className="hidden md:flex items-center gap-6 text-sm text-slate-400">
          <Link href="/" className="hover:text-white transition-colors">Markets</Link>
          <Link href="/create" className="hover:text-white transition-colors">Create Market</Link>
          <Link href="/dashboard" className="text-white border-b-2 border-violet-500 pb-1">Dashboard</Link>
          <Link href="/stats" className="hover:text-white transition-colors">Live Metrics</Link>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <div className="pulse-dot" />
            <span>Testnet</span>
          </div>
          {address ? (
            <div className="glass px-3 py-1.5 rounded-full text-sm text-violet-300 font-mono border border-violet-500/30">
              {shortenAddress(address)}
            </div>
          ) : (
            <button
              onClick={onOpenModal}
              className="px-4 py-1.5 rounded-full bg-gradient-to-r from-violet-600 to-cyan-600 text-white text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { address } = useWallet();
  const [showWalletModal, setShowWalletModal] = useState(false);

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data) => {
        setStats(data.stats);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen grid-bg relative">
      <DashboardNavbar address={address} onOpenModal={() => setShowWalletModal(true)} />
      {showWalletModal && <WalletModal onClose={() => setShowWalletModal(false)} />}
      
      <main className="max-w-5xl mx-auto px-6 pt-32 pb-24">
        <div className="mb-12 text-center relative z-10">
          <div className="inline-flex items-center gap-2 glass px-4 py-1.5 rounded-full text-sm text-cyan-300 mb-6 border border-cyan-500/20">
            <span className="pulse-dot !w-2 !h-2 bg-cyan-400" />
            Live Network Metrics
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 gradient-text">
            Analytics Dashboard
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Real-time insights across all decentralized prediction markets.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="glass rounded-3xl h-40 animate-pulse border border-white/5" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
            <StatCard 
              label="Total Users (DAU)" 
              value={stats?.totalUsers ?? "0"} 
              subtitle="Registered unique addresses"
              trend="+12% this week"
              trendUp={true}
            />
            <StatCard 
              label="Active Markets" 
              value={stats?.activeMarkets ?? "0"} 
              subtitle={`Out of ${stats?.totalMarkets ?? 0} total markets`}
            />
            <StatCard 
              label="Total Native XLM Volume" 
              value={formatCurrency(stats?.totalVolume ?? 0)} 
              subtitle="All-time trading volume"
              trend="+8.4% this week"
              trendUp={true}
            />
            <StatCard 
              label="Total Value Locked (TVL)" 
              value={formatCurrency(stats?.totalLiquidity ?? 0)} 
              subtitle="Liquidity pools & open interest"
            />
          </div>
        )}
      </main>

      {/* Decorative Orbs */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-violet-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-[100px]" />
      </div>
    </div>
  );
}

function StatCard({ label, value, subtitle, trend, trendUp }: any) {
  return (
    <div className="glass p-8 rounded-3xl border border-white/10 hover:border-violet-500/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-violet-500/10 flex flex-col justify-center relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
        </svg>
      </div>
      <p className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-2 relative z-10">{label}</p>
      <div className="flex items-end gap-4 relative z-10">
        <p className="text-4xl lg:text-5xl font-extrabold text-white tracking-tight">{value}</p>
        {trend && (
          <div className={`flex items-center gap-1 text-sm font-medium mb-1 ${trendUp ? 'text-green-400' : 'text-rose-400'}`}>
            <span>{trend}</span>
          </div>
        )}
      </div>
      <p className="text-sm text-slate-500 mt-4 relative z-10">{subtitle}</p>
    </div>
  );
}
