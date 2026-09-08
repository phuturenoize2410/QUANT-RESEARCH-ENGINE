import React, { useState, useMemo } from 'react';
import { 
  ShieldAlert, 
  AlertTriangle, 
  BarChart3, 
  Info, 
  Search, 
  ArrowUpDown, 
  CheckCircle,
  XCircle,
  HelpCircle
} from 'lucide-react';
import { StockData } from '../types';

interface GapDownLabViewProps {
  universe: StockData[];
  onSelectStock: (ticker: string) => void;
}

export const GapDownLabView: React.FC<GapDownLabViewProps> = ({
  universe,
  onSelectStock,
}) => {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'safe' | 'dangerous' | 'worstGap' | 'badGap'>('safe');

  const processedList = useMemo(() => {
    return universe
      .filter(s => search === '' || s.ticker.toLowerCase().includes(search.toLowerCase()))
      .map(stock => {
        const hist = stock.historicalStats;
        const total = Math.max(1, hist.comparableSetupsCount);
        const gaps = hist.matchedTrades.map(t => t.gapPct);

        const flatCount = gaps.filter(g => Math.abs(g) < 0.1).length;
        const gapDownCount = gaps.filter(g => g < -0.1).length;

        const flatRate = Math.round((flatCount / total) * 1000) / 10;
        const gapDownRate = Math.round((gapDownCount / total) * 1000) / 10;

        const badGap05Count = gaps.filter(g => g < -0.5).length;
        const badGap05Rate = Math.round((badGap05Count / total) * 1000) / 10;

        return {
          ...stock,
          flatRate,
          gapDownRate,
          badGap05Rate,
        };
      })
      .sort((a, b) => {
        if (sortBy === 'safe') return a.historicalStats.badGap1PctProb - b.historicalStats.badGap1PctProb;
        if (sortBy === 'dangerous') return b.historicalStats.badGap1PctProb - a.historicalStats.badGap1PctProb;
        if (sortBy === 'worstGap') return a.historicalStats.worstGap - b.historicalStats.worstGap;
        if (sortBy === 'badGap') return b.historicalStats.severeGap2PctProb - a.historicalStats.severeGap2PctProb;
        return 0;
      });
  }, [universe, search, sortBy]);

  return (
    <div className="w-full space-y-4 text-slate-200">
      
      {/* Title & Core Directive Banner */}
      <div className="bg-slate-900 border border-rose-900/40 rounded-lg p-4 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded bg-rose-950 text-rose-300 font-mono text-xs font-bold border border-rose-800/60 flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                DEDICATED GAP-DOWN & TAIL RISK LAB
              </span>
            </div>
            <h1 className="text-base sm:text-lg font-bold text-slate-100 uppercase tracking-wide">
              Tail Risk Anatomy: Protecting Capital at the Opening Bell
            </h1>
            <p className="text-xs text-slate-400 max-w-2xl">
              Execution Rule: If position opens negative and cut-loss condition is triggered, exit quickly. Therefore, stocks with rare or shallow gap-downs are dramatically favored over volatile jackpots.
            </p>
          </div>

          <div className="bg-rose-950/40 border border-rose-800/60 p-3 rounded-lg text-xs max-w-sm">
            <div className="flex items-center gap-1.5 font-bold text-rose-300 mb-1">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              IMPORTANT TRADER MANDATE:
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              <strong>"Gap Down Recovery Rate" is strictly informational.</strong> Do NOT reward a stock simply because it historically recovers intraday after gap-down. Opening gap loss triggers fast cut-loss!
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Sorting Options */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter ticker..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded pl-8 pr-3 py-1.5 text-xs text-slate-200"
            />
          </div>

          <div className="flex items-center gap-1.5 font-mono">
            <span className="text-slate-400">Sort:</span>
            <button
              onClick={() => setSortBy('safe')}
              className={`px-2.5 py-1 rounded text-xs font-bold transition ${
                sortBy === 'safe' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-950 text-slate-300 border border-slate-800'
              }`}
            >
              Safest (Lowest Bad Gap)
            </button>
            <button
              onClick={() => setSortBy('dangerous')}
              className={`px-2.5 py-1 rounded text-xs font-bold transition ${
                sortBy === 'dangerous' ? 'bg-rose-600 text-white' : 'bg-slate-950 text-slate-300 border border-slate-800'
              }`}
            >
              Most Dangerous (High Bad Gap)
            </button>
            <button
              onClick={() => setSortBy('worstGap')}
              className={`px-2.5 py-1 rounded text-xs font-bold transition ${
                sortBy === 'worstGap' ? 'bg-slate-700 text-white' : 'bg-slate-950 text-slate-300 border border-slate-800'
              }`}
            >
              Worst Historical Gap
            </button>
          </div>
        </div>

        <span className="text-[11px] font-mono text-slate-400">
          Evaluated <strong className="text-slate-200">{processedList.length}</strong> tickers
        </span>
      </div>

      {/* Main Gap Down Risk Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <th className="py-3 px-3">Ticker</th>
                <th className="py-3 px-3 text-right">Price</th>
                <th className="py-3 px-3 text-center text-emerald-400">Green Open %</th>
                <th className="py-3 px-3 text-center text-slate-400">Flat Open %</th>
                <th className="py-3 px-3 text-center text-rose-400">Gap Down %</th>
                <th className="py-3 px-3 text-right text-rose-400">Bad &lt; -0.5%</th>
                <th className="py-3 px-3 text-right text-rose-400 font-bold">Bad &lt; -1.0%</th>
                <th className="py-3 px-3 text-right text-rose-400 font-bold">Severe &lt; -2.0%</th>
                <th className="py-3 px-3 text-right text-rose-500 font-bold">Extreme &lt; -3.0%</th>
                <th className="py-3 px-3 text-right text-rose-300">Avg Neg Gap</th>
                <th className="py-3 px-3 text-right text-rose-400 font-black">Worst Gap</th>
                <th className="py-3 px-3 text-center text-slate-400">
                  <div className="flex items-center justify-center gap-1" title="Informational only. Not used to reward score!">
                    Recovery Rate <HelpCircle className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th className="py-3 px-3 text-center font-bold text-emerald-400">Tail Safety</th>
                <th className="py-3 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {processedList.map(stock => {
                const h = stock.historicalStats;
                const isHighRisk = h.badGap1PctProb >= 15 || h.severeGap2PctProb >= 5;

                return (
                  <tr 
                    key={stock.ticker}
                    className={`hover:bg-slate-800/50 transition cursor-pointer ${
                      isHighRisk ? 'bg-rose-950/15' : ''
                    }`}
                    onClick={() => onSelectStock(stock.ticker)}
                  >
                    <td className="py-3 px-3 font-sans">
                      <div className="flex flex-col">
                        <span className="font-extrabold text-slate-100 text-sm tracking-wide font-mono">
                          {stock.ticker}
                        </span>
                        <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                          {stock.name}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-3 text-right text-slate-200">
                      Rp {stock.price.toLocaleString('id-ID')}
                    </td>

                    <td className="py-3 px-3 text-center font-bold text-emerald-400">
                      {h.greenOpenRate}%
                    </td>

                    <td className="py-3 px-3 text-center text-slate-400">
                      {stock.flatRate}%
                    </td>

                    <td className="py-3 px-3 text-center font-bold text-rose-400">
                      {stock.gapDownRate}%
                    </td>

                    <td className="py-3 px-3 text-right text-rose-300">
                      {stock.badGap05Rate}%
                    </td>

                    <td className="py-3 px-3 text-right font-black text-rose-400">
                      {h.badGap1PctProb}%
                    </td>

                    <td className="py-3 px-3 text-right font-black text-rose-400">
                      {h.severeGap2PctProb}%
                    </td>

                    <td className="py-3 px-3 text-right text-rose-500 font-bold">
                      {h.extremeGap3PctProb}%
                    </td>

                    <td className="py-3 px-3 text-right text-rose-300">
                      {h.avgNegativeGap}%
                    </td>

                    <td className="py-3 px-3 text-right font-black text-rose-400">
                      {h.worstGap}%
                    </td>

                    {/* Informational Recovery Rate */}
                    <td className="py-3 px-3 text-center">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 border border-slate-700">
                        {h.gapDownRecoveryRate}%
                      </span>
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded font-black text-xs ${
                        stock.tailRiskScore >= 75 ? 'bg-emerald-950 text-emerald-300 border border-emerald-700' :
                        stock.tailRiskScore >= 50 ? 'bg-amber-950 text-amber-300 border border-amber-700' :
                        'bg-rose-950 text-rose-300 border border-rose-700'
                      }`}>
                        {stock.tailRiskScore}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-center font-sans" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => onSelectStock(stock.ticker)}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-semibold transition"
                      >
                        Deep Dive
                      </button>
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
