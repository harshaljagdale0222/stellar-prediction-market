"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { MarketMeta } from "@/lib/db";
import confetti from "canvas-confetti";
import {
  formatCurrency,
  calcBuyYes,
  calcSellYes,
  calcBuyNo,
  shortenAddress,
  submitTrade,
  WalletType,
} from "@/lib/stellar";
import WalletModal from "@/app/components/WalletModal";
import { useWallet } from "@/app/context/WalletContext";

// ── Toast ──────────────────────────────────────────────────────────────────────
function Toast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: "warn" | "success";
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-right-full duration-300">
      <div
        className={`glass rounded-2xl px-4 py-3 flex items-start gap-3 max-w-sm shadow-xl border ${
          type === "warn" ? "border-amber-500/30" : "border-green-500/30"
        }`}
      >
        <span className="text-xl mt-0.5">{type === "warn" ? "🦺" : "✅"}</span>
        <div className="flex-1">
          <p
            className={`text-sm font-semibold ${
              type === "warn" ? "text-amber-300" : "text-green-300"
            }`}
          >
            {type === "warn" ? "Warning" : "Success"}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">{message}</p>
        </div>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-slate-300 text-lg leading-none"
        >
          &times;
        </button>
      </div>
    </div>
  );
}

// ── Navbar ─────────────────────────────────────────────────────────────────────
function Navbar({
  address,
  onOpenModal,
}: {
  address: string | null;
  onOpenModal: () => void;
}) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/5">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center text-sm font-bold">
            ⭐
          </div>
          <span className="font-bold text-lg tracking-tight gradient-text">
            StellarPredict
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <div className="pulse-dot" />
            <span>Testnet</span>
          </div>
          {address ? (
            <button
              onClick={onOpenModal}
              className="glass px-3 py-1.5 rounded-full text-sm text-violet-300 font-mono border border-violet-500/30 hover:border-violet-400/60 transition-all"
            >
              {shortenAddress(address)}
            </button>
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

// ── Trading Panel ──────────────────────────────────────────────────────────────
function TradingPanel({
  market,
  walletAddress,
  walletType,
  onToast,
  onOpenWallet,
  onTradeSuccess,
}: {
  market: MarketMeta;
  walletAddress: string | null;
  walletType: WalletType | null;
  onToast: (msg: string, type: "warn" | "success") => void;
  onOpenWallet: () => void;
  onTradeSuccess: (update: Partial<MarketMeta>) => void;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<
    "buy_yes" | "buy_no" | "sell_yes" | "add_liquidity"
  >("buy_yes");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [txInfo, setTxInfo] = useState<{ hash: string; msg: string } | null>(null);

  const totalPool = market.liquidity;
  const reserveYes = totalPool * (1 - market.yesPrice);
  const reserveNo = totalPool * market.yesPrice;
  const parsedAmount = parseFloat(amount) || 0;

  let preview = { label: "", value: "", impact: "", newYesPrice: market.yesPrice };
  if (tab === "buy_yes" && parsedAmount > 0) {
    const r = calcBuyYes(reserveYes, reserveNo, parsedAmount);
    preview = {
      label: "YES tokens out",
      value: (r.yesOut && !isNaN(r.yesOut)) ? r.yesOut.toFixed(2) : "0.00",
      impact: `${(r.priceImpact && !isNaN(r.priceImpact)) ? r.priceImpact.toFixed(2) : "0.00"}% price impact`,
      newYesPrice: r.newYesPrice,
    };
  } else if (tab === "buy_no" && parsedAmount > 0) {
    const r = calcBuyNo(reserveYes, reserveNo, parsedAmount);
    preview = {
      label: "NO tokens out",
      value: (r.noOut && !isNaN(r.noOut)) ? r.noOut.toFixed(2) : "0.00",
      impact: `${(r.priceImpact && !isNaN(r.priceImpact)) ? r.priceImpact.toFixed(2) : "0.00"}% price impact`,
      newYesPrice: r.newYesPrice,
    };
  } else if (tab === "sell_yes" && parsedAmount > 0) {
    const r = calcSellYes(reserveYes, reserveNo, parsedAmount);
    preview = {
      label: "YES tokens needed",
      value: isFinite(r.yesIn) ? r.yesIn.toFixed(2) : "∞",
      impact: `${(r.priceImpact && !isNaN(r.priceImpact)) ? r.priceImpact.toFixed(2) : "0.00"}% price impact`,
      newYesPrice: r.newYesPrice,
    };
  } else if (tab === "add_liquidity" && parsedAmount > 0) {
    preview = {
      label: "LP tokens estimate",
      value: parsedAmount.toFixed(2),
      impact: "Proportional share",
      newYesPrice: market.yesPrice,
    };
  }

  const handleSubmit = async () => {
    if (!walletAddress) {
      onOpenWallet();
      return;
    }
    if (!parsedAmount) {
      onToast("Please enter an amount.", "warn");
      return;
    }
    const finalContractAddress = market.contractAddress || "CDLEEXCKX2O2X3CYBWDAPO5BJWNWP5H45AL3AXJFKR46D6WGDEPBNUZO";
    setLoading(true);

    try {
      const actionRef = tab as "buy_yes" | "buy_no" | "sell_yes" | "add_liquidity";
      const { txHash, message } = await submitTrade({
        contractAddress: finalContractAddress,
        action: actionRef,
        amount: parsedAmount,
        walletAddress: walletAddress!,
        walletType: walletType!,
      });
      setTxInfo({ hash: txHash, msg: message });
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#8b5cf6", "#0ea5e9", "#ec4899", "#facc15"],
      });
      onToast(message, "success");
      const rawPrice = preview.newYesPrice ?? market.yesPrice;
      const newPrice = (!isNaN(rawPrice) && isFinite(rawPrice)) ? rawPrice : 0.5;
      const patchData: Partial<MarketMeta> = {
        yesPrice: newPrice,
        noPrice: 1 - newPrice,
        volume: (market.volume || 0) + (parsedAmount || 0),
        yesVolume: (market.yesVolume || 0) + (actionRef === "buy_yes" ? (parsedAmount || 0) : 0),
        noVolume: (market.noVolume || 0) + (actionRef === "buy_no" ? (parsedAmount || 0) : 0),
        liquidity: (market.liquidity || 0) + (actionRef === "add_liquidity" ? (parsedAmount || 0) : 0),
      };
      fetch(`/api/markets/${market.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchData),
      }).catch(console.error);
      onTradeSuccess(patchData);
      setTimeout(() => router.refresh(), 500);
    } catch (e: any) {
      onToast(e.message || "Transaction failed or was rejected.", "warn");
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: "buy_yes", label: "Buy YES", color: "text-cyan-400" },
    { id: "buy_no", label: "Buy NO", color: "text-pink-400" },
    { id: "sell_yes", label: "Sell YES", color: "text-slate-300" },
    { id: "add_liquidity", label: "LP", color: "text-violet-400" },
  ] as const;

  return (
    <div className="relative glass rounded-3xl p-6 overflow-hidden shadow-2xl border border-white/10 bg-white/5 backdrop-blur-3xl hover:border-violet-500/30 transition-all duration-300">
      <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/10 rounded-full blur-[50px] pointer-events-none -mr-16 -mt-16"></div>
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-[50px] pointer-events-none -ml-16 -mb-16"></div>
      <div className="relative z-10">
      <h2 className="text-[10px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400 mb-4 tracking-widest uppercase">
        Execute Trade
      </h2>

      <div className="flex gap-1 glass rounded-xl p-1 mb-4">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTab(t.id);
              setTxInfo(null);
            }}
            className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
              tab === t.id
                ? `bg-white/10 text-white ${t.color}`
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mb-4">
        <label className="text-[10px] text-slate-500 mb-1.5 block">
          {tab === "sell_yes" ? "Collateral out (XLM)" : "Amount (XLM)"}
        </label>
        <div className="flex items-center glass rounded-xl border border-white/10 focus-within:border-violet-500/50 transition-colors">
          <input
            type="number"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setTxInfo(null);
            }}
            placeholder="0.00"
            className="flex-1 bg-transparent text-white px-4 py-3 outline-none text-sm font-mono"
          />
          <span className="text-slate-500 text-xs pr-4">XLM</span>
        </div>
      </div>

      {preview.label && parsedAmount > 0 && (
        <div className="glass rounded-xl p-3 mb-4 border border-white/5 bg-black/20">
          <div className="flex justify-between text-[10px] mb-1">
            <span className="text-slate-500">{preview.label}</span>
            <span className="text-white font-mono font-semibold">
              {preview.value}
            </span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-slate-500">Price Impact</span>
            <span className="text-amber-400">{preview.impact}</span>
          </div>
        </div>
      )}

      {txInfo ? (
        <div className="glass rounded-xl p-3 border border-green-500/20 mb-4">
          <p className="text-green-400 text-xs font-semibold">✅ Success</p>
          <a 
            href={`https://stellar.expert/explorer/testnet/tx/${txInfo.hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-violet-400 hover:text-violet-300 underline mt-1 block truncate"
          >
            View Hash: {txInfo.hash}
          </a>
        </div>
      ) : (
        <button
          onClick={handleSubmit}
          disabled={loading || !parsedAmount}
          className={`w-full py-4 rounded-2xl font-bold text-sm transition-all shadow-xl ${
            tab === "buy_yes"
              ? "bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400"
              : tab === "buy_no"
              ? "bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-400 hover:to-rose-400"
              : "bg-violet-600 hover:bg-violet-500"
          } disabled:opacity-50 text-white`}
        >
          {loading ? "Submitting…" : "Confirm Trade"}
        </button>
      )}
      </div>
    </div>
  );
}

// ── Probability Gauge ──────────────────────────────────────────────────────────
function ProbabilityGauge({ yesPrice }: { yesPrice: number }) {
  const safeYesPrice = (yesPrice && isFinite(yesPrice)) ? yesPrice : 0.5;
  const yes = Math.round(safeYesPrice * 100);
  const no = 100 - yes;
  return (
    <div className="relative glass rounded-3xl p-6 overflow-hidden shadow-2xl border border-white/10 bg-white/5 backdrop-blur-3xl transition-all duration-300 hover:border-white/20">
      <div className="absolute top-0 left-0 w-40 h-40 bg-pink-500/10 rounded-full blur-[60px] pointer-events-none -ml-20 -mt-20"></div>
      <div className="absolute bottom-0 right-0 w-40 h-40 bg-cyan-500/10 rounded-full blur-[60px] pointer-events-none -mr-20 -mb-20"></div>
      <div className="relative z-10">
      <h2 className="text-[10px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-orange-400 mb-6 tracking-widest uppercase">
        Live Odds & Probability
      </h2>
      <div className="flex gap-4 mb-4">
        <div className="flex-1 glass rounded-xl p-4 border border-cyan-500/10 text-center">
          <div className="text-3xl font-black text-cyan-400">{yes}%</div>
          <div className="text-[10px] text-slate-500 uppercase font-bold">YES</div>
        </div>
        <div className="flex-1 glass rounded-xl p-4 border border-pink-500/10 text-center">
          <div className="text-3xl font-black text-pink-400">{no}%</div>
          <div className="text-[10px] text-slate-500 uppercase font-bold">NO</div>
        </div>
      </div>
      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-300 transition-all duration-700"
          style={{ width: `${yes}%` }}
        />
      </div>
      </div>
    </div>
  );
}

export default function MarketClient({ initialMarket }: { initialMarket: MarketMeta }) {
  const [market, setMarket] = useState<MarketMeta>(initialMarket);
  const { address: walletAddress, walletType } = useWallet();
  const [toast, setToast] = useState<{ msg: string; type: "warn" | "success" } | null>(null);
  const [showWalletModal, setShowWalletModal] = useState(false);

  const dismissToast = useCallback(() => setToast(null), []);
  const showToast = useCallback((msg: string, type: "warn" | "success") => setToast({ msg, type }), []);

  const daysLeft = Math.max(0, Math.ceil((new Date(market.endDate).getTime() - Date.now()) / 86400000));

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#050812] font-sans">
      {/* Background with next/image for better performance */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <Image 
          src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop"
          alt="Cosmic Background"
          fill
          priority
          className="object-cover opacity-40"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[#050812]/80 backdrop-blur-3xl" />
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-violet-600/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-cyan-600/20 rounded-full blur-[120px] animate-pulse" />
      </div>

      <div className="relative z-50">
        <Navbar address={walletAddress} onOpenModal={() => setShowWalletModal(true)} />
      </div>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={dismissToast} />}
      {showWalletModal && <WalletModal onClose={() => setShowWalletModal(false)} />}

      <main className="max-w-7xl mx-auto px-6 pt-24 pb-16 relative z-10">
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-6">
          <Link href="/" className="hover:text-violet-400 transition-colors">Markets</Link>
          <span>/</span>
          <span className="text-slate-300 truncate max-w-xs">{market.title}</span>
        </div>

        <div className="relative glass rounded-3xl p-8 mb-8 overflow-hidden shadow-2xl border border-white/10 bg-white/5 backdrop-blur-2xl">
          <div className="relative z-10 flex flex-col md:flex-row items-start gap-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-600/40 to-cyan-600/40 border border-white/20 flex items-center justify-center text-4xl shrink-0 shadow-lg">
              {market.emoji}
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 border border-violet-500/40 text-violet-200 font-bold uppercase tracking-wider">
                  {market.category}
                </span>
                <span className="text-[10px] text-slate-400">{daysLeft} days remaining</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white mb-3 tracking-tight">
                {market.title}
              </h1>
              <p className="text-sm text-slate-400 leading-relaxed max-w-3xl">{market.description}</p>
            </div>
          </div>

          <div className="relative z-10 grid grid-cols-3 gap-6 mt-8 pt-6 border-t border-white/5">
            <div className="glass rounded-2xl p-4 bg-white/5">
              <div className="text-[10px] text-slate-500 mb-1 uppercase font-bold">Volume</div>
              <div className="text-xl font-black text-cyan-400">{formatCurrency(market.volume)}</div>
            </div>
            <div className="glass rounded-2xl p-4 bg-white/5">
              <div className="text-[10px] text-slate-500 mb-1 uppercase font-bold">Liquidity</div>
              <div className="text-xl font-black text-violet-400">{formatCurrency(market.liquidity)}</div>
            </div>
            <div className="glass rounded-2xl p-4 bg-white/5">
              <div className="text-[10px] text-slate-500 mb-1 uppercase font-bold">Contract</div>
              <div className="text-xs font-mono text-pink-300 truncate">{market.contractAddress ? shortenAddress(market.contractAddress) : "Pending"}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <ProbabilityGauge yesPrice={market.yesPrice} />
            
            <div className="glass rounded-3xl p-6 bg-white/[0.02]">
               <h3 className="text-xs font-bold text-slate-500 mb-4 uppercase tracking-widest">Market Sentiment</h3>
               <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-[10px] mb-1.5 font-bold uppercase">
                      <span className="text-cyan-400">YES Support</span>
                      <span className="text-white">{formatCurrency(market.yesVolume)}</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 transition-all duration-1000"
                        style={{ width: `${(market.yesVolume / (market.yesVolume + market.noVolume || 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] mb-1.5 font-bold uppercase">
                      <span className="text-pink-400">NO Support</span>
                      <span className="text-white">{formatCurrency(market.noVolume)}</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-pink-600 to-pink-400 transition-all duration-1000"
                        style={{ width: `${(market.noVolume / (market.yesVolume + market.noVolume || 1)) * 100}%` }}
                      />
                    </div>
                  </div>
               </div>
            </div>
          </div>

          <div>
             <TradingPanel
                market={market}
                walletAddress={walletAddress}
                walletType={walletType}
                onToast={showToast}
                onOpenWallet={() => setShowWalletModal(true)}
                onTradeSuccess={(update) => setMarket((m) => ({ ...m, ...update }))}
              />
          </div>
        </div>
      </main>
    </div>
  );
}
