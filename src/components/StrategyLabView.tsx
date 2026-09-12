import React, { useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import {
  StrategyLabCatalogSnapshot,
  StrategyLabSortMetric,
} from '../engine/researchApplication';
import { StockData } from '../types';

interface StrategyLabViewProps {
  universe: StockData[];
  getCatalog: (sortBy: StrategyLabSortMetric, category?: string) => StrategyLabCatalogSnapshot;
  onSelectStock: (ticker: string) => void;
}

export const StrategyLabView: React.FC<StrategyLabViewProps> = ({
  universe,
  getCatalog,
  onSelectStock,
}) => {
  const [sortBy, setSortBy] = useState<StrategyLabSortMetric>('edge');
  const [filterCategory] = useState<string>('ALL');

  const catalogSnapshot = useMemo(
    () => getCatalog(sortBy, filterCategory),
    [getCatalog, sortBy, filterCategory],
  );
  const sortedCombinations = catalogSnapshot.combinations;

  const knownUniverseTickers = useMemo(
    () => new Set(universe.map(stock => stock.ticker)),
    [universe],
  );

  return (
    <div className="w-full space-y-4 text-slate-200">
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 font-mono text-xs font-bold border border-purple-800/60">
              STRATEGY LAB
            </span>
            <h1 className="text-base sm:text-lg font-bold text-slate-100 uppercase tracking-wide">
              Combinatorial Setup Testing & Signal Discovery
            </h1>
          </div>
          <p className="text-xs text-slate-400">
            Compare multi-indicator rule combinations while the real point-in-time backtest path is being hardened.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-mono">Default Ranking:</span>
          <span className="px-2.5 py-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60 text-xs font-bold font-mono">
            RISK-ADJUSTED OVERNIGHT EDGE
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-amber-700/50 bg-amber-950/20 px-4 py-3">
        <div className="text-[11px] font-black uppercase tracking-wider text-amber-300">
          {catalogSnapshot.provenance.label}
        </div>
        <div className="mt-1 text-xs text-amber-100/75">
          {catalogSnapshot.provenance.description}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-400 font-medium">Sort By:</span>
          <button
            onClick={() => setSortBy('edge')}
            className={`px-3 py-1 rounded font-bold transition font-mono ${
              sortBy === 'edge' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            Highest Risk-Adjusted Edge
          </button>
          <button
            onClick={() => setSortBy('winRate')}
            className={`px-3 py-1 rounded font-bold transition font-mono ${
              sortBy === 'winRate' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            Highest Green Open Rate
          </button>
          <button
            onClick={() => setSortBy('lowestBadGap')}
            className={`px-3 py-1 rounded font-bold transition font-mono ${
              sortBy === 'lowestBadGap' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            Lowest Bad Gap (&lt; -1%)
          </button>
          <button
            onClick={() => setSortBy('netExpectancy')}
            className={`px-3 py-1 rounded font-bold transition font-mono ${
              sortBy === 'netExpectancy' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            Highest Net Expectancy
          </button>
        </div>

        <div className="text-[11px] text-slate-400 font-mono">
          Evaluating <strong className="text-slate-200">{sortedCombinations.length}</strong> prototype setup configurations
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-800">
                <th className="py-3 px-3 text-center">Rank</th>
                <th className="py-3 px-3">Setup Combination</th>
                <th className="py-3 px-3 text-center">Category</th>
                <th className="py-3 px-3 text-center">Prototype Setups</th>
                <th className="py-3 px-3 text-center">Green Open Rate</th>
                <th className="py-3 px-3 text-right">Avg Net Gap</th>
                <th className="py-3 px-3 text-right">Median</th>
                <th className="py-3 px-3 text-right text-rose-400">Bad Gap &lt;-1%</th>
                <th className="py-3 px-3 text-right text-rose-400">Severe &lt;-2%</th>
                <th className="py-3 px-3 text-right text-emerald-300">Net EV</th>
                <th className="py-3 px-3 text-center">Confidence</th>
                <th className="py-3 px-3 text-center font-bold text-emerald-400">Risk-Adjusted Edge</th>
                <th className="py-3 px-3">Prototype Sample Tickers</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-mono">
              {sortedCombinations.map((combo, idx) => {
                const isWinner = idx === 0;

                return (
                  <tr
                    key={combo.id}
                    className={`hover:bg-slate-800/50 transition ${
                      isWinner ? 'bg-emerald-950/20' : combo.riskAdjustedEdgeScore < 50 ? 'opacity-65' : ''
                    }`}
                  >
                    <td className="py-3 px-3 text-center">
                      <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-black ${
                        idx === 0 ? 'bg-emerald-500 text-slate-950' : 'text-slate-500'
                      }`}>
                        {idx + 1}
                      </span>
                    </td>

                    <td className="py-3 px-3 font-sans">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-100 text-xs flex items-center gap-1.5">
                          {combo.name}
                          {isWinner && <Sparkles className="w-3.5 h-3.5 text-amber-400 inline" />}
                        </span>
                        <span className="text-[11px] text-slate-400 max-w-sm">
                          {combo.description}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-3 text-center font-sans">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] border border-slate-700">
                        {combo.category}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-center text-slate-300">{combo.historicalSetups}</td>

                    <td className="py-3 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded font-black text-xs ${
                        combo.greenOpenRate >= 68
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-600/50'
                          : combo.greenOpenRate >= 60
                          ? 'bg-emerald-950/50 text-emerald-400'
                          : 'bg-rose-950/50 text-rose-400'
                      }`}>
                        {combo.greenOpenRate}%
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right font-bold text-slate-200">
                      {combo.avgNetGap >= 0 ? `+${combo.avgNetGap.toFixed(2)}%` : `${combo.avgNetGap.toFixed(2)}%`}
                    </td>

                    <td className="py-3 px-3 text-right text-slate-300">
                      {combo.medianGap >= 0 ? '+' : ''}{combo.medianGap.toFixed(2)}%
                    </td>

                    <td className="py-3 px-3 text-right font-bold text-rose-400">{combo.badGapProb}%</td>
                    <td className="py-3 px-3 text-right font-bold text-rose-400">{combo.severeGapProb}%</td>

                    <td className={`py-3 px-3 text-right font-black text-xs ${
                      combo.expectedValue >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {combo.expectedValue >= 0 ? '+' : ''}{combo.expectedValue}%
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span className="text-slate-300 font-bold">{combo.confidence}%</span>
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span className={`px-2.5 py-1 rounded font-black text-xs ${
                        combo.riskAdjustedEdgeScore >= 80
                          ? 'bg-emerald-500 text-slate-950'
                          : combo.riskAdjustedEdgeScore >= 65
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                          : 'bg-rose-950 text-rose-300 border border-rose-800'
                      }`}>
                        {combo.riskAdjustedEdgeScore}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex flex-wrap gap-1">
                        {combo.sampleTickers.map(ticker => {
                          const existsInUniverse = knownUniverseTickers.has(ticker);
                          return (
                            <button
                              key={ticker}
                              onClick={() => existsInUniverse && onSelectStock(ticker)}
                              disabled={!existsInUniverse}
                              title={existsInUniverse ? 'Open stock analysis' : 'Prototype ticker is not present in the current provider universe'}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition ${
                                existsInUniverse
                                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
                                  : 'bg-slate-900 text-slate-600 cursor-not-allowed border border-slate-800'
                              }`}
                            >
                              {ticker}
                            </button>
                          );
                        })}
                      </div>
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
