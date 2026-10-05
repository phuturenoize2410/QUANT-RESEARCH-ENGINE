import React from 'react';
import { 
  X, 
  ShieldAlert, 
  TrendingUp, 
  Flame, 
  BarChart2, 
  Compass, 
  CheckCircle2, 
  AlertTriangle, 
  Layers,
  ArrowUpRight,
  BookmarkPlus,
  ExternalLink
} from 'lucide-react';
import { StockData } from '../types';
import { buildStockQuantProfile, classifyMarketRegime } from '../engine/quantLabEngine';
import { calculateKellyPositionFraction } from '../engine/analytics';

interface StockQuantProfileModalProps {
  stock: StockData;
  universe: StockData[];
  onClose: () => void;
  onSelectStock?: (ticker: string) => void;
  onAddToJournal?: (stock: StockData) => void;
}

export const StockQuantProfileModal: React.FC<StockQuantProfileModalProps> = ({
  stock,
  universe,
  onClose,
  onSelectStock,
  onAddToJournal,
}) => {
  const { regime } = classifyMarketRegime(universe);
  const profile = buildStockQuantProfile(stock, regime);
  const kellyFraction = calculateKellyPositionFraction(
    stock.historicalStats.greenOpenRate,
    stock.expectedNetGap > 0 ? stock.expectedNetGap : 1.2,
    stock.historicalStats.avgNegativeGap ? Math.abs(stock.historicalStats.avgNegativeGap) : 0.8,
    0.5
  );

  const radarMetrics = [
    { label: 'Trend Strength', value: profile.trendScore, color: 'emerald' },
    { label: 'Momentum Velocity', value: profile.momentumScore, color: 'cyan' },
    { label: 'Volatility Calmness', value: profile.volatilityScore, color: 'blue' },
    { label: 'Bandarmology Flow', value: profile.volumeBandarScore, color: 'purple' },
    { label: 'Tail Risk Safety', value: profile.tailRiskScore, color: 'amber' },
    { label: 'Overnight Edge', value: profile.overnightEdgeScore, color: 'emerald' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-3xl w-full p-6 text-slate-200 relative my-8">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-center font-mono font-black text-lg text-emerald-400">
              {stock.ticker}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-100">{stock.name}</h2>
                <span className="text-xs font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                  {stock.sector}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm font-mono mt-0.5">
                <span className="text-slate-100 font-semibold">Rp {stock.price.toLocaleString('id-ID')}</span>
                <span className={stock.changePct >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  {stock.changePct >= 0 ? `+${stock.changePct}%` : `${stock.changePct}%`}
                </span>
                <span className="text-slate-500 text-xs">| Vol: {(stock.volume / 1e6).toFixed(1)}M shares</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onAddToJournal && (
              <button
                onClick={() => {
                  onAddToJournal(stock);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition shadow-md shadow-emerald-900/30"
              >
                <BookmarkPlus className="w-3.5 h-3.5" />
                Add to Morning Exit
              </button>
            )}
            {onSelectStock && (
              <button
                onClick={() => {
                  onSelectStock(stock.ticker);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700"
              >
                Full Analysis
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Quant Profile Badge & Best Matching Strategy */}
        <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800/90 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-emerald-400" />
              Algorithmic Best Fit Strategy
            </div>
            <div className="text-base font-extrabold text-emerald-400 font-sans mt-0.5">
              {profile.bestMatchingStrategyName}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              Identified as highest statistical synergy based on current multi-timeframe profile.
            </div>
          </div>

          <div className="flex items-center gap-3 font-mono text-xs">
            <div className="px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-center">
              <div className="text-[10px] text-emerald-300">Half-Kelly Size</div>
              <div className="text-emerald-400 font-extrabold">{kellyFraction}%</div>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-center">
              <div className="text-[10px] text-slate-400">VaR (95%)</div>
              <div className="text-rose-400 font-bold">{profile.var95 > 0 ? `-${profile.var95}%` : '0.0%'}</div>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-center">
              <div className="text-[10px] text-slate-400">Expected Shortfall</div>
              <div className="text-rose-300 font-bold">{profile.cvar95 > 0 ? `-${profile.cvar95}%` : '0.0%'}</div>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-center">
              <div className="text-[10px] text-slate-400">Overnight Score</div>
              <div className="text-emerald-400 font-extrabold">{profile.overnightEdgeScore}</div>
            </div>
          </div>
        </div>

        {/* Multi-Dimensional Quant Dimensions */}
        <div className="mt-5">
          <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-3">
            Six-Dimensional Quantitative Rating
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {radarMetrics.map(m => (
              <div key={m.label} className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <div className="flex items-center justify-between text-xs mb-1.5 font-mono">
                  <span className="text-slate-300">{m.label}</span>
                  <span className="font-bold text-slate-100">{m.value} / 100</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${
                      m.value >= 75 ? 'bg-emerald-500' :
                      m.value >= 55 ? 'bg-cyan-500' :
                      m.value >= 40 ? 'bg-amber-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${m.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Strategy Fit Matrix */}
        <div className="mt-5">
          <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            Cross-Strategy Suitability Matrix
          </h3>
          <div className="space-y-2">
            {profile.strategyFitScores.map((fit, idx) => (
              <div 
                key={fit.strategyId}
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/40 border border-slate-800/70 text-xs font-mono hover:border-slate-700 transition"
              >
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 text-[10px] w-4">#{idx + 1}</span>
                  <span className="text-slate-200 font-medium font-sans">{fit.strategyName}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-1.5 rounded-full bg-slate-800 overflow-hidden hidden sm:block">
                    <div 
                      className={`h-full rounded-full ${
                        fit.fitScore >= 70 ? 'bg-emerald-500' : fit.fitScore >= 50 ? 'bg-cyan-500' : 'bg-slate-600'
                      }`}
                      style={{ width: `${fit.fitScore}%` }}
                    />
                  </div>
                  <span className="text-slate-300 font-bold w-12 text-right">{fit.fitScore}/100</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold w-24 text-center ${
                    fit.signal === 'STRONG BUY' ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40' :
                    fit.signal === 'BUY' ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-700/30' :
                    fit.signal === 'WATCH' ? 'bg-amber-950/50 text-amber-300 border border-amber-700/30' :
                    'bg-slate-800 text-slate-400'
                  }`}>
                    {fit.signal}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Explainability Strengths and Risks */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-800 text-xs">
          <div>
            <span className="text-emerald-400 font-bold font-mono uppercase flex items-center gap-1.5 mb-2">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Quant Conviction Drivers
            </span>
            <ul className="space-y-1.5 text-slate-300">
              {stock.positiveFactors.slice(0, 3).map((f, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-emerald-400 font-bold">•</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <span className="text-rose-400 font-bold font-mono uppercase flex items-center gap-1.5 mb-2">
              <AlertTriangle className="w-3.5 h-3.5" />
              Quant Risk Penalties
            </span>
            <ul className="space-y-1.5 text-slate-300">
              {stock.riskFactors.slice(0, 3).map((r, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-rose-400 font-bold">•</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

      </div>
    </div>
  );
};
