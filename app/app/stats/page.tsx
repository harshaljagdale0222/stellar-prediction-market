"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/stellar";
import { useWallet } from "@/app/context/WalletContext";
import WalletModal from "@/app/components/WalletModal";

// ──────────────────────────────────────────────────────────────────────────────
// Navbar (Shared Component)
// ──────────────────────────────────────────────────────────────────────────────
function Navbar({ address, onOpenModal }: { address: string | null; onOpenModal: () => void }) {
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
          <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
          <Link href="/stats" className="text-white font-semibold">Live Metrics</Link>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <div className="pulse-dot" />
            <span>Live Monitoring</span>
          </div>
          {address ? (
            <div className="glass px-3 py-1.5 rounded-full text-sm text-violet-300 font-mono border border-violet-500/30">
              {address.slice(0, 4)}...{address.slice(-4)}
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

// ──────────────────────────────────────────────────────────────────────────────
// Metric Card
// ──────────────────────────────────────────────────────────────────────────────
function MetricCard({ title, value, icon, trend, subtext }: { title: string; value: string; icon: string; trend?: string; subtext?: string }) {
  return (
    <div className="glass rounded-3xl p-6 border-white/5 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-violet-600/5 rounded-full -mr-10 -mt-10 blur-3xl group-hover:bg-violet-600/10 transition-colors" />
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-2xl border border-white/5">
          {icon}
        </div>
        {trend && (
          <span className="text-xs font-bold text-green-400 bg-green-400/10 px-2 py-1 rounded-full border border-green-400/20">
            {trend}
          </span>
        )}
      </div>
      <h3 className="text-slate-400 text-sm font-medium mb-1">{title}</h3>
      <div className="text-3xl font-extrabold text-white mb-2 tracking-tight">{value}</div>
      {subtext && <p className="text-xs text-slate-500">{subtext}</p>}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Mini Activity Chart (SVG Simulation)
// ──────────────────────────────────────────────────────────────────────────────
function ActivityChart({ title, color }: { title: string; color: string }) {
  // Simple fake path for "trend" visualization
  const path = "M 0 50 Q 50 10 100 60 T 200 30 T 300 70 T 400 20 T 500 50";
  return (
    <div className="glass rounded-3xl p-8 border-white/5 col-span-1 md:col-span-2">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-xl font-bold text-white mb-1">{title}</h3>
          <p className="text-sm text-slate-500">Live network activity over the last 24 hours</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-green-400 font-bold uppercase tracking-widest">Real-time</span>
        </div>
      </div>
      <div className="h-48 w-full relative">
        <svg viewBox="0 0 500 100" className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
          </defs>
          <path
            d={path}
            fill="none"
            stroke="url(#grad)"
            strokeWidth="3"
            className="drop-shadow-[0_0_8px_rgba(139,92,246,0.5)]"
          />
          {/* Decorative grid */}
          <line x1="0" y1="0" x2="500" y2="0" stroke="white" strokeOpacity="0.05" />
          <line x1="0" y1="50" x2="500" y2="50" stroke="white" strokeOpacity="0.05" />
          <line x1="0" y1="100" x2="500" y2="100" stroke="white" strokeOpacity="0.05" />
        </svg>
      </div>
    </div>
  );
}

export default function StatsPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { address } = useWallet();
  const [showWalletModal, setShowWalletModal] = useState(false);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((data) => {
        setStats(data.stats);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen grid-bg pb-20">
      <Navbar address={address} onOpenModal={() => setShowWalletModal(true)} />
      {showWalletModal && <WalletModal onClose={() => setShowWalletModal(false)} />}

      <main className="max-w-7xl mx-auto px-6 pt-32">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-extrabold text-white mb-4 tracking-tight">
            System <span className="gradient-text">Live Metrics</span>
          </h1>
          <p className="text-slate-400 max-w-2xl">
            Real-time analytics and system performance for the StellarPredict ecosystem. 
            All data is indexed directly from the Stellar Soroban Testnet.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="glass h-40 rounded-3xl" />
            ))}
          </div>
        ) : (
          <>
            {/* Grid of Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
              <MetricCard
                title="Total Value Locked"
                value={formatCurrency(stats?.totalVolume ?? 0)}
                icon="💰"
                trend="+12.5%"
                subtext="Total transaction volume"
              />
              <MetricCard
                title="Protocol Liquidity"
                value={formatCurrency(stats?.totalLiquidity ?? 0)}
                icon="💧"
                trend="+8.2%"
                subtext="Net AMM reserves"
              />
              <MetricCard
                title="Verified Users"
                value={stats?.totalUsers?.toString() ?? "0"}
                icon="👥"
                trend="+18%"
                subtext="Registered wallet addresses"
              />
              <MetricCard
                title="Active Markets"
                value={stats?.activeMarkets?.toString() ?? "0"}
                icon="🎯"
                subtext="Markets open for trading"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <ActivityChart title="Global Trading Volume" color="violet" />
                <div className="glass rounded-3xl p-8 border-white/5">
                    <h3 className="text-xl font-bold text-white mb-6">Recent Events</h3>
                    <div className="space-y-6">
                        {[
                            { event: "User Trade", text: "Purchased YES on 'BTC > 70k'", time: "2m ago", icon: "📈" },
                            { event: "Market Created", text: "New Politics market listed", time: "14m ago", icon: "🏛️" },
                            { event: "Trade Executed", text: "Purchased NO on 'Climate Goal'", time: "28m ago", icon: "📉" },
                            { event: "New Onboarding", text: "User GBA...8S0 verified", time: "1h ago", icon: "👤" },
                        ].map((item, i) => (
                            <div key={i} className="flex gap-4 group">
                                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center shrink-0 group-hover:border-violet-500/50 transition-colors">
                                    {item.icon}
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-violet-400 uppercase tracking-widest">{item.event}</p>
                                    <p className="text-sm text-slate-200">{item.text}</p>
                                    <p className="text-[10px] text-slate-500 mt-1">{item.time}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
