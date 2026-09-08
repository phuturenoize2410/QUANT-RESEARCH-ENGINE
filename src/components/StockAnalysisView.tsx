import React, { useState, useMemo } from 'react';
import { 
  ChevronDown, 
  Sparkles, 
  AlertTriangle, 
  TrendingUp, 
  Layers, 
  CheckCircle2, 
  BarChart2, 
  ShieldCheck,
  Calendar,
  Zap,
  Clock,
  PlusCircle
} from 'lucide-react';
import { StockData, DailyBar } from '../types';

interface StockAnalysisViewProps {
  selectedStock: StockData;
  universe: StockData[];
  onSelectStock: (ticker: string) => void;
  onAddToJournal: (stock: StockData) => void;
}

export const StockAnalysisView: React.FC<StockAnalysisViewProps> = ({
  selectedStock,
  universe,
  onSelectStock,
  onAddToJournal,
}) => {
  const [activeChartTab, setActiveChartTab] = useState<'CANDLE' | 'GAP_DIST' | 'BANDAR'>('CANDLE');
  const [hoveredBar, setHoveredBar] = useState<DailyBar | null>(null);

  const bars = selectedStock.historicalBars;
  const recentBars = useMemo(() => bars.slice(-40), [bars]);
  const tech = selectedStock.technical;
  const hist = selectedStock.historicalStats;
  const bandar = selectedStock.bandarmology;

  // Candlestick SVG chart calculations
  const chartHeight = 260;
  const volHeight = 70;
  const chartWidth = 720;
  const padding = { top: 20, right: 60, bottom: 25, left: 10 };

  const minPrice = useMemo(() => {
    const lows = recentBars.map(b => b.low);
    return Math.min(...lows) * 0.985;
  }, [recentBars]);

  const maxPrice = useMemo(() => {
    const highs = recentBars.map(b => b.high);
    return Math.max(...highs) * 1.015;
  }, [recentBars]);

  const maxVolume = useMemo(() => {
    const vols = recentBars.map(b => b.volume);
    return Math.max(...vols) * 1.15;
  }, [recentBars]);

  const priceToY = (price: number) => {
    return chartHeight - padding.bottom - ((price - minPrice) / (maxPrice - minPrice)) * (chartHeight - padding.top - padding.bottom);
  };

  const volToY = (vol: number) => {
    return volHeight - (vol / maxVolume) * (volHeight - 10);
  };

  const barWidth = Math.max(4, Math.floor((chartWidth - padding.left - padding.right) / recentBars.length) - 3);

  // Distribution buckets for the stock's historical overnight gaps
  const gapDistribution = useMemo(() => {
    const gaps = hist.matchedTrades.map(t => t.gapPct);
    const bins = [
      { label: '< -2%', min: -Infinity, max: -2.0, count: 0, isNegative: true },
      { label: '-2% to -1%', min: -2.0, max: -1.0, count: 0, isNegative: true },
      { label: '-1% to 0%', min: -1.0, max: 0.0, count: 0, isNegative: true },
      { label: '0% to +0.5%', min: 0.0, max: 0.5, count: 0, isNegative: false },
      { label: '+0.5% to +1.5%', min: 0.5, max: 1.5, count: 0, isNegative: false },
      { label: '+1.5% to +2.5%', min: 1.5, max: 2.5, count: 0, isNegative: false },
      { label: '> +2.5%', min: 2.5, max: Infinity, count: 0, isNegative: false },
    ];

    gaps.forEach(g => {
      const bin = bins.find(b => g >= b.min && g < b.max);
      if (bin) bin.count++;
    });

    const maxCount = Math.max(1, ...bins.map(b => b.count));
    return bins.map(b => ({
      ...b,
      pct: gaps.length > 0 ? Math.round((b.count / gaps.length) * 100) : 0,
      heightRatio: b.count / maxCount,
    }));
  }, [hist.matchedTrades]);

  return (
    <div className="w-full space-y-4 text-slate-200">
      
      {/* Top Ticker Selector & Core Quote Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          {/* Ticker Selector Dropdown */}
          <div className="relative">
            <select
              value={selectedStock.ticker}
              onChange={e => onSelectStock(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-slate-100 font-mono font-black text-lg sm:text-xl rounded px-3 py-1.5 focus:outline-hidden focus:border-emerald-500 cursor-pointer"
            >
              {universe.map(s => (
                <option key={s.ticker} value={s.ticker}>
                  {s.ticker} — {s.name} ({s.decision})
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl sm:text-2xl font-black font-mono text-slate-100">
                Rp {selectedStock.price.toLocaleString('id-ID')}
              </span>
              <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                selectedStock.changePct >= 0 
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60' 
                  : 'bg-rose-950 text-rose-400 border border-rose-800/60'
              }`}>
                {selectedStock.changePct >= 0 ? `+${selectedStock.changePct}%` : `${selectedStock.changePct}%`}
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              {selectedStock.sector} • Turnover: Rp {(selectedStock.turnover / 1e9).toFixed(1)}B • Rel Vol: {selectedStock.relativeVolume}x
            </div>
          </div>
        </div>

        {/* Quick Decision Tag & Buy Button */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[10px] text-slate-400 font-mono uppercase">Overnight Edge Score</div>
            <div className="text-2xl font-black font-mono text-emerald-400">
              {selectedStock.overnightEdgeScore}
              <span className="text-xs text-slate-500 font-normal"> / 100</span>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className={`px-3 py-1 rounded text-xs font-black uppercase text-center border ${
              selectedStock.decision === 'STRONG BUY' ? 'bg-emerald-950 text-emerald-300 border-emerald-500' :
              selectedStock.decision === 'BUY' ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700' :
              selectedStock.decision === 'WATCH' ? 'bg-amber-950 text-amber-300 border-amber-600' :
              'bg-slate-800 text-slate-400 border-slate-700'
            }`}>
              {selectedStock.decision}
            </span>
            <button
              onClick={() => onAddToJournal(selectedStock)}
              className="flex items-center justify-center gap-1 px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded transition shadow-md"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Add to Journal
            </button>
          </div>
        </div>
      </div>

      {/* Grid: Left Column (Chart & Technicals), Right Column ("WHY THIS STOCK?" probabilistic AI panel) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left 7 Columns: Interactive Chart & Technical Indicators */}
        <div className="lg:col-span-7 space-y-4">
          
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveChartTab('CANDLE')}
                  className={`px-3 py-1 rounded text-xs font-bold transition ${
                    activeChartTab === 'CANDLE' ? 'bg-slate-800 text-emerald-300 border border-slate-700' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Candlestick & Volume
                </button>
                <button
                  onClick={() => setActiveChartTab('GAP_DIST')}
                  className={`px-3 py-1 rounded text-xs font-bold transition ${
                    activeChartTab === 'GAP_DIST' ? 'bg-slate-800 text-emerald-300 border border-slate-700' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Overnight Gap Distribution
                </button>
                <button
                  onClick={() => setActiveChartTab('BANDAR')}
                  className={`px-3 py-1 rounded text-xs font-bold transition ${
                    activeChartTab === 'BANDAR' ? 'bg-slate-800 text-emerald-300 border border-slate-700' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Broker Summary
                </button>
              </div>

              <div className="text-[11px] font-mono text-slate-400 hidden sm:block">
                {hoveredBar ? (
                  <span>
                    {hoveredBar.date} | C: Rp {hoveredBar.close.toLocaleString()} | Vol: {(hoveredBar.volume / 1000000).toFixed(1)}M
                  </span>
                ) : (
                  <span>Last 40 Trading Days</span>
                )}
              </div>
            </div>

            {/* View 1: Candlestick & Volume Chart */}
            {activeChartTab === 'CANDLE' && (
              <div className="space-y-2">
                <div className="relative w-full overflow-x-auto">
                  <svg 
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
                    className="w-full h-auto bg-slate-950/60 rounded border border-slate-800/80"
                  >
                    {/* Horizontal Grid lines */}
                    {[0.25, 0.5, 0.75].map(ratio => {
                      const p = minPrice + (maxPrice - minPrice) * ratio;
                      const y = priceToY(p);
                      return (
                        <g key={ratio}>
                          <line x1={padding.left} y1={y} x2={chartWidth - padding.right} y2={y} stroke="#1e293b" strokeDasharray="3 3" />
                          <text x={chartWidth - padding.right + 6} y={y + 3} fill="#64748b" fontSize="9" fontFamily="monospace">
                            Rp {Math.round(p).toLocaleString()}
                          </text>
                        </g>
                      );
                    })}

                    {/* Candlesticks */}
                    {recentBars.map((bar, i) => {
                      const x = padding.left + i * ((chartWidth - padding.left - padding.right) / recentBars.length) + 2;
                      const yOpen = priceToY(bar.open);
                      const yClose = priceToY(bar.close);
                      const yHigh = priceToY(bar.high);
                      const yLow = priceToY(bar.low);
                      const isUp = bar.close >= bar.open;
                      const candleColor = isUp ? '#10b981' : '#f43f5e';
                      const bodyY = Math.min(yOpen, yClose);
                      const bodyHeight = Math.max(2, Math.abs(yClose - yOpen));

                      return (
                        <g 
                          key={bar.date} 
                          onMouseEnter={() => setHoveredBar(bar)}
                          onMouseLeave={() => setHoveredBar(null)}
                          className="cursor-pointer"
                        >
                          {/* Wick */}
                          <line x1={x + barWidth / 2} y1={yHigh} x2={x + barWidth / 2} y2={yLow} stroke={candleColor} strokeWidth="1.2" />
                          {/* Body */}
                          <rect x={x} y={bodyY} width={barWidth} height={bodyHeight} fill={candleColor} rx="1" />
                        </g>
                      );
                    })}
                  </svg>
                </div>

                {/* Volume Sub-chart */}
                <div className="relative w-full overflow-x-auto">
                  <svg viewBox={`0 0 ${chartWidth} ${volHeight}`} className="w-full h-auto bg-slate-950/40 rounded border border-slate-800/80">
                    {recentBars.map((bar, i) => {
                      const x = padding.left + i * ((chartWidth - padding.left - padding.right) / recentBars.length) + 2;
                      const y = volToY(bar.volume);
                      const height = volHeight - y;
                      const isUp = bar.close >= bar.open;
                      return (
                        <rect 
                          key={bar.date}
                          x={x} 
                          y={y} 
                          width={barWidth} 
                          height={height} 
                          fill={isUp ? '#065f46' : '#881337'} 
                          opacity="0.85" 
                        />
                      );
                    })}
                    <text x={padding.left + 5} y={15} fill="#64748b" fontSize="9" fontFamily="monospace">
                      Volume: Max {(maxVolume / 1e6).toFixed(1)}M shares
                    </text>
                  </svg>
                </div>
              </div>
            )}

            {/* View 2: Gap Distribution Histogram */}
            {activeChartTab === 'GAP_DIST' && (
              <div className="space-y-3 p-2">
                <div className="text-xs text-slate-400">
                  Historical overnight opening gap distribution for matched <strong className="text-slate-200">{hist.comparableSetupsCount} similar setups</strong>:
                </div>
                <div className="space-y-2">
                  {gapDistribution.map((bin, i) => (
                    <div key={i} className="flex items-center gap-3 text-xs font-mono">
                      <span className="w-24 text-slate-400 text-right">{bin.label}</span>
                      <div className="flex-1 bg-slate-950 h-5 rounded overflow-hidden flex items-center p-0.5">
                        <div 
                          className={`h-full rounded ${bin.isNegative ? 'bg-rose-500' : 'bg-emerald-500'}`}
                          style={{ width: `${Math.max(4, bin.pct)}%` }}
                        />
                      </div>
                      <span className={`w-16 font-bold ${bin.isNegative ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {bin.count} ({bin.pct}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* View 3: Broker Summary Bandarmology Breakdown */}
            {activeChartTab === 'BANDAR' && (
              <div className="space-y-4 p-2 text-xs">
                <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded border border-slate-800 font-mono">
                  <div>
                    <span className="text-slate-400">Classification: </span>
                    <strong className="text-emerald-400">{bandar.status}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Foreign Flow: </span>
                    <strong className={bandar.netForeignFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {bandar.netForeignFlow >= 0 ? '+' : ''}Rp {(bandar.netForeignFlow / 1e9).toFixed(1)}B
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Streak: </span>
                    <strong className="text-amber-400">{bandar.accumulationStreakDays} Days Accum</strong>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-950/80 p-2.5 rounded border border-emerald-900/40">
                    <span className="font-bold text-emerald-400 text-xs block mb-1">Top Buyers (Concentration {bandar.top3BuyerConcentration}%)</span>
                    <div className="space-y-1 font-mono text-[11px]">
                      {bandar.topBuyers.map(b => (
                        <div key={b.brokerCode} className="flex justify-between text-slate-300">
                          <span>{b.brokerCode} - {b.brokerName}</span>
                          <span className="font-bold">{b.percentage}%</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-slate-950/80 p-2.5 rounded border border-rose-900/40">
                    <span className="font-bold text-rose-400 text-xs block mb-1">Top Sellers (Concentration {bandar.top3SellerConcentration}%)</span>
                    <div className="space-y-1 font-mono text-[11px]">
                      {bandar.topSellers.map(s => (
                        <div key={s.brokerCode} className="flex justify-between text-slate-300">
                          <span>{s.brokerCode} - {s.brokerName}</span>
                          <span className="font-bold">{s.percentage}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Technical Signals KPI Grid */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3.5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div className="bg-slate-950 p-2 rounded border border-slate-800">
              <span className="text-slate-500 text-[10px] block">RSI(14)</span>
              <span className={`text-sm font-bold ${tech.rsi14 > 70 ? 'text-amber-400' : 'text-slate-200'}`}>
                {tech.rsi14}
              </span>
            </div>
            <div className="bg-slate-950 p-2 rounded border border-slate-800">
              <span className="text-slate-500 text-[10px] block">MA Trend</span>
              <span className={`text-sm font-bold ${tech.ma5 > tech.ma10 ? 'text-emerald-400' : 'text-slate-300'}`}>
                {tech.ma5 > tech.ma10 ? 'MA5 > MA10' : 'MA5 < MA10'}
              </span>
            </div>
            <div className="bg-slate-950 p-2 rounded border border-slate-800">
              <span className="text-slate-500 text-[10px] block">Relative Volume</span>
              <span className="text-sm font-bold text-emerald-400">
                {tech.relativeVolume}x
              </span>
            </div>
            <div className="bg-slate-950 p-2 rounded border border-slate-800">
              <span className="text-slate-500 text-[10px] block">Close in Day Range</span>
              <span className="text-sm font-bold text-emerald-400">
                {Math.round(tech.closePositionInRange * 100)}%
              </span>
            </div>
          </div>
        </div>

        {/* Right 5 Columns: AI-Style Explanation Panel: "WHY THIS STOCK?" */}
        <div className="lg:col-span-5 space-y-4">
          
          <div className="bg-slate-900 border border-emerald-500/50 rounded-lg p-4 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-slate-100 uppercase tracking-wider text-xs">
                  Why This Stock? (Probabilistic Edge)
                </h3>
              </div>
              <span className="text-[10px] font-mono bg-emerald-950 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-800/60">
                EXPLAINABLE AI ENGINE
              </span>
            </div>

            {/* Core Probability Stats Box */}
            <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-2 font-mono text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">GREEN OPEN PROBABILITY:</span>
                <span className="text-base font-black text-emerald-400">
                  {hist.greenOpenRate.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Historical Matches:</span>
                <span className="text-slate-200 font-bold">{hist.comparableSetupsCount} sessions</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Average Overnight Gap:</span>
                <span className="text-emerald-400 font-bold">+{hist.avgOvernightGap.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Median Overnight Gap:</span>
                <span className="text-emerald-400 font-bold">+{hist.medianOvernightGap.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between text-rose-400">
                <span>Bad Gap Risk (&lt; -1%):</span>
                <span className="font-bold">{hist.badGap1PctProb.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between text-rose-400">
                <span>Severe Gap Risk (&lt; -2%):</span>
                <span className="font-bold">{hist.severeGap2PctProb.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between text-slate-500 pt-1 border-t border-slate-800/80">
                <span>Worst Historical Gap:</span>
                <span className="text-rose-400 font-bold">{hist.worstGap.toFixed(1)}%</span>
              </div>
            </div>

            {/* Positive Drivers */}
            <div className="space-y-1.5 text-xs">
              <span className="font-bold text-emerald-400 uppercase tracking-wide text-[11px] block">
                Positive Factors Supporting Overnight Edge:
              </span>
              <ul className="space-y-1">
                {selectedStock.positiveFactors.map((factor, idx) => (
                  <li key={idx} className="flex items-start gap-1.5 text-slate-300 text-[11px] leading-relaxed">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{factor}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Risk Factors */}
            <div className="space-y-1.5 text-xs">
              <span className="font-bold text-rose-400 uppercase tracking-wide text-[11px] block">
                Known Risk Factors & Tail Watchouts:
              </span>
              <ul className="space-y-1">
                {selectedStock.riskFactors.map((risk, idx) => (
                  <li key={idx} className="flex items-start gap-1.5 text-slate-300 text-[11px] leading-relaxed">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                    <span>{risk}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Probabilistic Conclusion */}
            <div className="bg-emerald-950/30 border border-emerald-800/60 p-3 rounded text-xs space-y-1">
              <span className="font-black text-emerald-300 uppercase tracking-wide text-[11px] block">
                Execution Recommendation:
              </span>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                {selectedStock.aiConclusion}
              </p>
            </div>
          </div>

        </div>

      </div>

      {/* Historical Matched Setups Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-xl space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-cyan-400" />
            <h3 className="font-bold text-slate-200 uppercase tracking-wider text-xs">
              Comparable Historical Setups & Subsequent Overnight Opens ({hist.matchedTrades.length} Matches)
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            Green: <strong className="text-emerald-400">{hist.greenOpenCount}</strong> | Red: <strong className="text-rose-400">{hist.redOpenCount}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <th className="py-2 px-3">Date</th>
                <th className="py-2 px-3 text-right">Entry Close</th>
                <th className="py-2 px-3 text-right">Next Morning Open</th>
                <th className="py-2 px-3 text-right">Overnight Gap</th>
                <th className="py-2 px-3 text-right">Pre-Close Day %</th>
                <th className="py-2 px-3 text-right">Rel Vol</th>
                <th className="py-2 px-3 text-center">Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {hist.matchedTrades.slice(0, 10).map((t, idx) => {
                const isGreen = t.gapPct > 0;
                return (
                  <tr key={idx} className="hover:bg-slate-800/40">
                    <td className="py-2 px-3 text-slate-400">{t.date}</td>
                    <td className="py-2 px-3 text-right text-slate-200">Rp {t.entryClose.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right text-slate-200">Rp {t.nextOpen.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right font-bold">
                      <span className={isGreen ? 'text-emerald-400' : 'text-rose-400'}>
                        {isGreen ? `+${t.gapPct}%` : `${t.gapPct}%`}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right text-slate-300">+{t.dayReturnPct}%</td>
                    <td className="py-2 px-3 text-right text-slate-400">{t.relVolume}x</td>
                    <td className="py-2 px-3 text-center font-sans">
                      {isGreen ? (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 text-[10px] font-bold">
                          GREEN OPEN
                        </span>
                      ) : t.gapPct < -1.0 ? (
                        <span className="px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 text-[10px] font-bold">
                          BAD GAP
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">
                          SMALL RED
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
