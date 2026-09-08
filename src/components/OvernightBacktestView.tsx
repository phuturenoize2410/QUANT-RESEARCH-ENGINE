import React, { useState, useMemo } from 'react';
import { 
  Play, 
  BarChart3, 
  TrendingUp, 
  AlertTriangle, 
  ShieldCheck, 
  Coins, 
  Percent, 
  Sliders,
  RotateCcw
} from 'lucide-react';
import { StockData, StrategySettings, BacktestSummary } from '../types';
import { runBacktest } from '../engine/analytics';

interface OvernightBacktestViewProps {
  universe: StockData[];
  settings: StrategySettings;
  onUpdateSettings: (settings: StrategySettings) => void;
  onSelectStock: (ticker: string) => void;
}

export const OvernightBacktestView: React.FC<OvernightBacktestViewProps> = ({
  universe,
  settings,
  onUpdateSettings,
  onSelectStock,
}) => {
  const [minEdgeScore, setMinEdgeScore] = useState<number>(60);
  const [minGreenRate, setMinGreenRate] = useState<number>(55);
  const [maxBadGap, setMaxBadGap] = useState<number>(12);
  const [selectedDecision, setSelectedDecision] = useState<'ALL_BUYS' | 'STRONG_ONLY'>('ALL_BUYS');

  const backtestResult = useMemo<BacktestSummary>(() => {
    return runBacktest(universe, settings, {
      minEdgeScore,
      minGreenRate,
      maxBadGap,
      decisionOnly: selectedDecision === 'STRONG_ONLY' ? ['STRONG BUY'] : ['STRONG BUY', 'BUY'],
    });
  }, [universe, settings, minEdgeScore, minGreenRate, maxBadGap, selectedDecision]);

  // Equity Curve Chart Dimensions
  const chartWidth = 720;
  const chartHeight = 220;
  const padding = { top: 15, right: 30, bottom: 25, left: 50 };

  const equityData = backtestResult.equityCurve;
  const minEquity = useMemo(() => {
    if (equityData.length === 0) return 90;
    return Math.min(...equityData.map(d => d.equity)) * 0.98;
  }, [equityData]);

  const maxEquity = useMemo(() => {
    if (equityData.length === 0) return 120;
    return Math.max(...equityData.map(d => d.equity)) * 1.02;
  }, [equityData]);

  const equityPoints = useMemo(() => {
    if (equityData.length === 0) return '';
    return equityData.map((d, i) => {
      const x = padding.left + (i / Math.max(1, equityData.length - 1)) * (chartWidth - padding.left - padding.right);
      const y = chartHeight - padding.bottom - ((d.equity - minEquity) / Math.max(1, maxEquity - minEquity)) * (chartHeight - padding.top - padding.bottom);
      return `${x},${y}`;
    }).join(' ');
  }, [equityData, minEquity, maxEquity]);

  return (
    <div className="w-full space-y-4 text-slate-200">
      
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-mono text-xs font-bold border border-emerald-800/60">
              STRICT OVERNIGHT STRATEGY BACKTEST
            </span>
          </div>
          <h1 className="text-base sm:text-lg font-bold text-slate-100 uppercase tracking-wide">
            Buy at 15:45 Close &rarr; Sell at 09:00 Next Morning Open
          </h1>
          <p className="text-xs text-slate-400">
            Simulates actual overnight trades across all historical matched setups. Reflects IDX buy & sell fees ({settings.buyFeePct + settings.sellFeePct}%) and slippage ({settings.slippagePct}%).
          </p>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs">
          <div className="bg-slate-950 px-3 py-1.5 rounded border border-slate-800 text-right">
            <span className="text-slate-500 text-[10px] block">TOTAL NET EV</span>
            <span className="text-emerald-400 font-extrabold text-sm">
              +{backtestResult.expectedValuePerTrade}% / trade
            </span>
          </div>
        </div>
      </div>

      {/* Backtest Parameters Filter Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-slate-400 font-medium">Filter Decision:</label>
            <select
              value={selectedDecision}
              onChange={e => setSelectedDecision(e.target.value as any)}
              className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-slate-200 text-xs font-mono"
            >
              <option value="ALL_BUYS">STRONG BUY + BUY</option>
              <option value="STRONG_ONLY">STRONG BUY ONLY</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-slate-400 font-medium">Min Edge Score:</label>
            <input
              type="number"
              min="40"
              max="90"
              value={minEdgeScore}
              onChange={e => setMinEdgeScore(Number(e.target.value))}
              className="w-16 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs font-mono"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-slate-400 font-medium">Max Bad Gap Allowed:</label>
            <div className="flex items-center gap-1 font-mono">
              <input
                type="number"
                min="3"
                max="25"
                value={maxBadGap}
                onChange={e => setMaxBadGap(Number(e.target.value))}
                className="w-16 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs font-mono"
              />
              <span className="text-slate-500">%</span>
            </div>
          </div>
        </div>

        <div className="text-slate-400 text-xs font-mono">
          Frictions: Buy {settings.buyFeePct}% + Sell {settings.sellFeePct}% + Slip {settings.slippagePct}% = <strong className="text-slate-200">{(settings.buyFeePct + settings.sellFeePct + settings.slippagePct).toFixed(2)}%</strong>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 font-mono text-xs">
        <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg">
          <span className="text-slate-500 text-[10px] block">TOTAL TRADES</span>
          <span className="text-lg font-black text-slate-100">{backtestResult.totalTrades}</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg">
          <span className="text-slate-500 text-[10px] block">GREEN OPEN RATE</span>
          <span className="text-lg font-black text-emerald-400">{backtestResult.winRate}%</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg">
          <span className="text-slate-500 text-[10px] block">AVG NET RETURN</span>
          <span className="text-lg font-black text-emerald-400">+{backtestResult.avgNetReturn}%</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg">
          <span className="text-slate-500 text-[10px] block">MEDIAN NET RETURN</span>
          <span className="text-lg font-black text-emerald-400">+{backtestResult.medianNetReturn}%</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg">
          <span className="text-slate-500 text-[10px] block">PROFIT FACTOR</span>
          <span className="text-lg font-black text-cyan-400">{backtestResult.profitFactor}</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg">
          <span className="text-slate-500 text-[10px] block">MAX DRAWDOWN</span>
          <span className="text-lg font-black text-rose-400">-{backtestResult.maxDrawdownPct}%</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg">
          <span className="text-slate-500 text-[10px] block">BAD GAP (&lt; -1%)</span>
          <span className="text-lg font-black text-amber-400">{backtestResult.badGap1PctRate}%</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg">
          <span className="text-slate-500 text-[10px] block">SHARPE RATIO</span>
          <span className="text-lg font-black text-emerald-400">{backtestResult.sharpeRatio}</span>
        </div>
      </div>

      {/* Middle Row: Equity Curve & Return Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Equity Curve (7 Cols) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <h3 className="font-bold text-slate-200 uppercase tracking-wider text-xs">
                Strategy Compounded Equity Curve (Baseline 100)
              </h3>
            </div>
            <span className="text-[11px] font-mono text-emerald-400 font-bold">
              Final: {equityData[equityData.length - 1]?.equity ?? 100}
            </span>
          </div>

          <div className="w-full overflow-x-auto">
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto bg-slate-950/60 rounded border border-slate-800/60">
              {/* Baseline 100 line */}
              <line 
                x1={padding.left} 
                y1={chartHeight - padding.bottom - ((100 - minEquity) / (maxEquity - minEquity)) * (chartHeight - padding.top - padding.bottom)} 
                x2={chartWidth - padding.right} 
                y2={chartHeight - padding.bottom - ((100 - minEquity) / (maxEquity - minEquity)) * (chartHeight - padding.top - padding.bottom)} 
                stroke="#475569" 
                strokeDasharray="4 4" 
              />
              <polyline
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                points={equityPoints}
              />
            </svg>
          </div>
          <div className="flex justify-between text-[10px] font-mono text-slate-500 px-2">
            <span>Trade #1</span>
            <span>Trade #{backtestResult.totalTrades}</span>
          </div>
        </div>

        {/* Return Distribution Histogram (5 Cols) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-cyan-400" />
              <h3 className="font-bold text-slate-200 uppercase tracking-wider text-xs">
                Distribution of Overnight Gaps
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              Tail risk on left
            </span>
          </div>

          <div className="space-y-1.5 pt-1">
            {backtestResult.gapReturnDistribution.map((b, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px] font-mono">
                <span className="w-24 text-slate-400 text-right shrink-0">{b.range}</span>
                <div className="flex-1 bg-slate-950 h-4 rounded overflow-hidden flex items-center p-0.5">
                  <div 
                    className={`h-full rounded ${b.isLoss ? 'bg-rose-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.max(2, b.percentage)}%` }}
                  />
                </div>
                <span className={`w-14 text-right font-bold shrink-0 ${b.isLoss ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {b.percentage}%
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};
