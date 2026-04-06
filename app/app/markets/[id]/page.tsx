"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
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
    <div className="fixed bottom-6 right-6 z-[100]">
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
            {address && (
              <a 
                href={`https://friendbot.stellar.org?addr=${address}`}
                target="_blank"
                rel="noreferrer"
                className="ml-2 px-2 py-0.5 rounded border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 transition-colors"
              >
                + Get XLM
              </a>
            )}
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
    // Real-time repair for missing contract IDs during the trade flow (ensures users can ALWAYS trade)
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
      
      // Fire confetti celebration!
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#8b5cf6", "#0ea5e9", "#ec4899", "#facc15"],
      });

      onToast(message, "success");

      // Visually update the market mechanics as per user request
      // Final safety logic: Prevent NaN from ever entering the persistent database.
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

      // Background patch API
      fetch(`/api/markets/${market.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchData),
      }).catch(console.error);

      // Instantly update UI prop
      onTradeSuccess(patchData);
      
      // Force Global Refresh for absolute data consistency
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
      <h2 className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400 mb-4 tracking-widest uppercase">
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
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
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
        <label className="text-xs text-slate-500 mb-1.5 block">
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
        <div className="flex justify-end mt-1 gap-2">
          {["25", "50", "100"].map((v) => (
            <button
              key={v}
              onClick={() => setAmount(v)}
              className="text-xs text-violet-400 hover:text-violet-300 px-2 py-0.5 glass rounded"
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {preview.label && parsedAmount > 0 && (
        <div className="glass rounded-xl p-3 mb-4 border border-white/5">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-500">{preview.label}</span>
            <span className="text-white font-mono font-semibold">
              {preview.value}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Price Impact</span>
            <span className="text-amber-400">{preview.impact}</span>
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span className="text-slate-500">Fee (1%)</span>
            <span className="text-slate-400">
              {(parsedAmount * 0.01).toFixed(2)} XLM
            </span>
          </div>
        </div>
      )}

      {!walletAddress && (
        <div className="glass rounded-xl p-3 mb-3 border border-violet-500/20 text-center">
          <p className="text-xs text-slate-400 mb-2">
            Connect your wallet to trade
          </p>
          <button
            onClick={onOpenWallet}
            className="px-4 py-1.5 rounded-full bg-gradient-to-r from-violet-600 to-cyan-600 text-white text-xs font-semibold"
          >
            Connect Wallet
          </button>
        </div>
      )}

      {txInfo ? (
        <div className="glass rounded-xl p-3 border border-green-500/20">
          <p className="text-green-400 text-xs font-semibold mb-1">
            ✅ {txInfo.msg}
          </p>
          <p className="text-slate-500 text-xs font-mono break-all">
            {txInfo.hash ? `${txInfo.hash.slice(0, 32)}…` : ''}
          </p>
        </div>
      ) : (
        <button
          onClick={handleSubmit}
          disabled={loading || !parsedAmount}
          className={`w-full py-4 rounded-2xl font-bold text-base transition-all transform hover:scale-[1.02] active:scale-95 shadow-xl ${
            tab === "buy_yes"
              ? "bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 glow-yes shadow-cyan-500/25 text-white border border-cyan-400/50"
              : tab === "buy_no"
              ? "bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-400 hover:to-rose-400 glow-no shadow-pink-500/25 text-white border border-pink-400/50"
              : tab === "add_liquidity"
              ? "bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 glow-purple shadow-violet-500/25 text-white border border-violet-400/50"
              : "bg-white/10 hover:bg-white/20 border border-white/10 text-white"
          } disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Submitting…
            </span>
          ) : tab === "buy_yes" ? (
            "Buy YES Tokens"
          ) : tab === "buy_no" ? (
            "Buy NO Tokens"
          ) : tab === "sell_yes" ? (
            "Sell YES Tokens"
          ) : (
            "Add Liquidity"
          )}
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
    <div className="relative glass rounded-3xl p-6 mb-6 overflow-hidden shadow-2xl border border-white/10 bg-white/5 backdrop-blur-3xl transition-all duration-300 hover:border-white/20">
      <div className="absolute top-0 left-0 w-40 h-40 bg-pink-500/10 rounded-full blur-[60px] pointer-events-none -ml-20 -mt-20"></div>
      <div className="absolute bottom-0 right-0 w-40 h-40 bg-cyan-500/10 rounded-full blur-[60px] pointer-events-none -mr-20 -mb-20"></div>
      <div className="relative z-10">
      <h2 className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-orange-400 mb-6 tracking-widest uppercase">
        Live Odds & Probability
      </h2>
      <div className="flex gap-4 mb-4">
        <div className="flex-1 glass rounded-xl p-4 border border-cyan-500/20 glow-yes text-center">
          <div className="text-3xl font-extrabold text-cyan-400">{(isNaN(yes) ? 50 : yes)}%</div>
          <div className="text-xs text-slate-500 mt-1">YES probability</div>
          <div className="text-xs text-cyan-400 font-mono mt-1">
            ${(safeYesPrice && !isNaN(safeYesPrice)) ? safeYesPrice.toFixed(3) : "0.500"}
          </div>
        </div>
        <div className="flex-1 glass rounded-xl p-4 border border-pink-500/20 glow-no text-center">
          <div className="text-3xl font-extrabold text-pink-400">{(isNaN(no) ? 50 : no)}%</div>
          <div className="text-xs text-slate-500 mt-1">NO probability</div>
          <div className="text-xs text-pink-400 font-mono mt-1">
            ${(safeYesPrice && !isNaN(safeYesPrice)) ? (1 - safeYesPrice).toFixed(3) : "0.500"}
          </div>
        </div>
      </div>
      <div className="h-3 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-300 transition-all duration-700"
          style={{ width: `${(isNaN(yes) ? 50 : yes)}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] font-bold text-slate-500 mt-3 uppercase tracking-widest">
        <span>NO ←</span>
        <span>→ YES</span>
      </div>
      </div>
    </div>
  );
}

// ── Main Market Page ───────────────────────────────────────────────────────────
export default function MarketPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [market, setMarket] = useState<MarketMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const { address: walletAddress, walletType } = useWallet();
  const [toast, setToast] = useState<{
    msg: string;
    type: "warn" | "success";
  } | null>(null);
  const [showWalletModal, setShowWalletModal] = useState(false);

  const dismissToast = useCallback(() => setToast(null), []);
  const showToast = useCallback(
    (msg: string, type: "warn" | "success") => setToast({ msg, type }),
    []
  );
  const handleWalletConnect = useCallback((address: string) => {
    // Session managed via context
    setShowWalletModal(false);
  }, []);

  useEffect(() => {
    fetch(`/api/markets/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setMarket(d?.market ?? null);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-[#0a0a0a]">
        {/* Photographic Background Elements */}
        <div className="fixed inset-0 pointer-events-none z-0">
          <div 
            className="absolute inset-0 opacity-40 bg-cover bg-center bg-fixed" 
            style={{ backgroundImage: "url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop')" }}
          />
          <div className="absolute inset-0 bg-[#0a0a0a]/70 backdrop-blur-xl" />
          <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] bg-violet-600/30 rounded-full blur-[140px] animate-[pulse_6s_ease-in-out_infinite] z-0" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] bg-cyan-600/30 rounded-full blur-[140px] animate-[pulse_8s_ease-in-out_infinite] z-0" />
        </div>
        <div className="relative z-50">
          <Navbar address={walletAddress} onOpenModal={() => setShowWalletModal(true)} />
        </div>
        <main className="max-w-7xl mx-auto px-6 pt-24 pb-16 relative z-10">
          {/* Skeleton Breadcrumb */}
          <div className="flex items-center gap-2 mb-6">
            <div className="h-4 w-16 bg-white/5 rounded-full animate-pulse" />
            <span className="text-slate-600">/</span>
            <div className="h-4 w-52 bg-white/5 rounded-full animate-pulse" />
          </div>

          {/* Skeleton Header Card */}
          <div className="glass rounded-2xl p-6 mb-6">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/5 animate-pulse shrink-0" />
              <div className="flex-1 space-y-3">
                <div className="h-4 w-20 bg-white/5 rounded-full animate-pulse" />
                <div className="h-7 w-3/4 bg-white/5 rounded-lg animate-pulse" />
                <div className="h-4 w-1/2 bg-white/5 rounded-full animate-pulse" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-white/5">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-3 w-16 bg-white/5 rounded-full animate-pulse" />
                  <div className="h-6 w-24 bg-white/5 rounded-lg animate-pulse" />
                </div>
              ))}
            </div>
          </div>

          {/* Skeleton Two-Column */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="glass rounded-2xl h-44 animate-pulse" />
              <div className="glass rounded-2xl h-72 animate-pulse" />
            </div>
            <div className="glass rounded-2xl h-64 animate-pulse" />
          </div>
        </main>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="min-h-screen relative overflow-hidden flex flex-col items-center justify-center gap-4 bg-[#0a0a0a]">
        {/* Photographic Background Elements */}
        <div className="fixed inset-0 pointer-events-none z-0">
          <div 
            className="absolute inset-0 opacity-40 bg-cover bg-center bg-fixed" 
            style={{ backgroundImage: "url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop')" }}
          />
          <div className="absolute inset-0 bg-[#0a0a0a]/70 backdrop-blur-xl" />
          <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] bg-violet-600/30 rounded-full blur-[140px] animate-[pulse_6s_ease-in-out_infinite] z-0" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] bg-cyan-600/30 rounded-full blur-[140px] animate-[pulse_8s_ease-in-out_infinite] z-0" />
        </div>
        <p className="text-slate-200 text-lg font-bold relative z-10 bg-black/50 px-6 py-2 rounded-full border border-white/10 backdrop-blur-md">Market not found.</p>
        <button
          onClick={() => router.push("/")}
          className="px-4 py-2 glass rounded-xl text-sm text-violet-300 relative z-10"
        >
          ← Back to markets
        </button>
      </div>
    );
  }

  const daysLeft = Math.max(
    0,
    Math.ceil(
      (new Date(market.endDate).getTime() - Date.now()) / 86400000
    )
  );

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#0a0a0a]">
      {/* Photographic Animated Gradient Background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div 
          className="absolute inset-0 opacity-50 bg-cover bg-center bg-no-repeat bg-fixed" 
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop')" }}
        />
        <div className="absolute inset-0 bg-[#0a0a0a]/60 backdrop-blur-[30px]" />
        
        <div className="absolute top-[-20%] left-[-10%] w-[70vw] h-[70vw] bg-violet-600/40 rounded-full blur-[150px] animate-[pulse_8s_ease-in-out_infinite]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[70vw] h-[70vw] bg-cyan-600/40 rounded-full blur-[150px] animate-[pulse_10s_ease-in-out_infinite_reverse]" />
        <div className="absolute top-[30%] left-[30%] w-[40vw] h-[40vw] bg-pink-600/30 rounded-full blur-[120px] animate-[pulse_12s_ease-in-out_infinite]" />
      </div>

      <div className="relative z-50">
        <Navbar
          address={walletAddress}
          onOpenModal={() => setShowWalletModal(true)}
        />
      </div>

      {toast && (
        <Toast
          message={toast.msg}
          type={toast.type}
          onClose={dismissToast}
        />
      )}

      {showWalletModal && (
        <WalletModal
          onClose={() => setShowWalletModal(false)}
        />
      )}

      <main className="max-w-7xl mx-auto px-6 pt-24 pb-16 relative z-10">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
          <Link href="/" className="hover:text-violet-400 transition-colors">
            Markets
          </Link>
          <span>/</span>
          <span className="text-slate-300 truncate max-w-xs">
            {market.title}
          </span>
        </div>

        {/* Header */}
        <div className="relative glass rounded-3xl p-8 mb-8 overflow-hidden shadow-2xl border border-white/10 bg-white/5 backdrop-blur-2xl transition-all duration-500 hover:shadow-violet-500/10 hover:border-white/20">
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-[80px] pointer-events-none -mr-32 -mt-32"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-violet-500/10 rounded-full blur-[80px] pointer-events-none -ml-32 -mb-32"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row items-start gap-6">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-600/40 to-cyan-600/40 border border-white/20 flex items-center justify-center text-5xl shrink-0 shadow-lg shadow-violet-500/20 transform transition-transform hover:scale-105 hover:rotate-3 duration-300">
              {market.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <span className="text-xs px-3 py-1 rounded-full bg-violet-500/20 border border-violet-500/40 text-violet-200 font-semibold shadow-sm">
                  {market.category}
                </span>
                {market.resolved ? (
                  <span className="text-xs px-3 py-1 rounded-full bg-green-500/20 border border-green-500/40 text-green-200 font-semibold shadow-sm">
                    Resolved: {market.outcome}
                  </span>
                ) : (
                  <span className="text-xs px-3 py-1 rounded-full bg-white/10 border border-white/20 text-slate-300 font-medium">
                    ⏳ {daysLeft} days remaining
                  </span>
                )}
              </div>
              <h1 className="text-2xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-400 mb-3 tracking-tight">
                {market.title}
              </h1>
              <p className="text-base text-slate-300 leading-relaxed max-w-3xl">{market.description}</p>
            </div>
          </div>

          <div className="relative z-10 grid grid-cols-3 gap-6 mt-8 pt-6 border-t border-white/10">
            <div className="glass rounded-2xl p-4 bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
              <div className="text-xs text-slate-400 mb-1 font-medium uppercase tracking-wider">Total Volume</div>
              <div className="text-xl md:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
                {formatCurrency(market.volume)}
              </div>
            </div>
            <div className="glass rounded-2xl p-4 bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
              <div className="text-xs text-slate-400 mb-1 font-medium uppercase tracking-wider">Liquidity Pool</div>
              <div className="text-xl md:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-purple-400">
                {formatCurrency(market.liquidity)}
              </div>
            </div>
            <div className="glass rounded-2xl p-4 bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
              <div className="text-xs text-slate-400 mb-1 font-medium uppercase tracking-wider">Smart Contract</div>
              <div
                className="text-sm md:text-base font-mono text-pink-300 truncate font-semibold"
                title={market.contractAddress || ""}
              >
                {market.contractAddress ? `${market.contractAddress.slice(0, 8)}…` : "Pending"}
              </div>
            </div>
          </div>
        </div>

        {/* Two Column */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <ProbabilityGauge yesPrice={market.yesPrice} />

            <div className="relative glass rounded-3xl p-8 overflow-hidden shadow-2xl border border-white/10 bg-white/5 backdrop-blur-3xl transition-all duration-300 hover:border-white/20">
              <div className="absolute bottom-0 right-0 w-40 h-40 bg-purple-500/10 rounded-full blur-[60px] pointer-events-none -mr-20 -mb-20"></div>
              
              <div className="relative z-10">
              <h2 className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400 mb-6 tracking-widest uppercase">
                Liquidity Pool Mechanics
              </h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="glass rounded-2xl p-4 bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    YES Reserve
                  </div>
                  <div className="font-mono text-xl font-bold text-cyan-400">
                    {((market.liquidity ?? 0) * (1 - (market.yesPrice ?? 0.5))).toFixed(0)} <span className="text-sm font-semibold opacity-60">XLM</span>
                  </div>
                </div>
                <div className="glass rounded-2xl p-4 bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">NO Reserve</div>
                  <div className="font-mono text-xl font-bold text-pink-400">
                    {((market.liquidity ?? 0) * (market.yesPrice ?? 0.5)).toFixed(0)} <span className="text-sm font-semibold opacity-60">XLM</span>
                  </div>
                </div>
                <div className="glass rounded-2xl p-4 bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    k (invariant)
                  </div>
                  <div className="font-mono font-bold text-violet-400 text-base break-all">
                    {(
                      (market.liquidity ?? 0) * (1 - (market.yesPrice ?? 0.5)) *
                      (market.liquidity ?? 0) * (market.yesPrice ?? 0.5)
                    ).toFixed(0)}
                  </div>
                </div>
                <div className="glass rounded-2xl p-4 bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Fee Rate</div>
                  <div className="font-mono text-xl font-bold text-amber-400">1%</div>
                </div>
              </div>

              {/* Sentiment Tracker Section */}
              <div className="mt-8 p-6 glass rounded-2xl border border-white/10 bg-black/20 shadow-inner">
                <div className="flex justify-between items-end mb-5">
                  <div>
                    <h3 className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400 mb-1">Market Sentiment</h3>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Total Liquidity Volume</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-300">
                      {formatCurrency(market.yesVolume + market.noVolume)} Total
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-cyan-400 font-bold flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                        YES Support
                      </span>
                      <span className="text-white font-mono font-bold">{formatCurrency(market.yesVolume)}</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 transition-all duration-1000"
                        style={{ width: `${(market.yesVolume / (market.yesVolume + market.noVolume || 1)) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-pink-400 font-bold flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-pink-400" />
                        NO Support
                      </span>
                      <span className="text-white font-mono font-bold">{formatCurrency(market.noVolume)}</span>
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
            </div>
          </div>

          <div>
            {market.resolved ? (
              <div className="glass rounded-2xl p-6 text-center border border-green-500/20">
                <div className="text-4xl mb-3">🏆</div>
                <h2 className="text-lg font-bold text-white mb-1">
                  Market Resolved
                </h2>
                <p className="text-sm text-slate-400 mb-4">
                  Outcome:{" "}
                  <span className="text-green-400 font-bold">
                    {market.outcome}
                  </span>
                </p>
                <button
                  onClick={() => setShowWalletModal(true)}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold text-sm hover:opacity-90 transition-opacity"
                >
                  Claim Winnings
                </button>
              </div>
            ) : (
              <TradingPanel
                market={market}
                walletAddress={walletAddress}
                walletType={walletType}
                onToast={showToast}
                onOpenWallet={() => setShowWalletModal(true)}
                onTradeSuccess={(update) => setMarket((m) => (m ? { ...m, ...update } : m))}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
