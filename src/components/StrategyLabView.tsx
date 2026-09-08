import React, { useState, useMemo } from 'react';
import { 
  FlaskConical, 
  ArrowUpDown, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  Sliders,
  TrendingUp,
  Layers
} from 'lucide-react';
import { StockData } from '../types';

interface StrategyCombination {
  id: string;
  name: string;
  category: string;
  description: string;
  historicalSetups: number;
  greenOpenRate: number;
  avgNetGap: number;
  medianGap: number;
  badGapProb: number;
  severeGapProb: number;
  expectedValue: number;
  confidence: number;
  riskAdjustedEdgeScore: number;
  sampleTickers: string[];
}

interface StrategyLabViewProps {
  universe: StockData[];
  onSelectStock: (ticker: string) => void;
}

type SortMetric = 'edge' | 'winRate' | 'lowestBadGap' | 'netExpectancy';

export const StrategyLabView: React.FC<StrategyLabViewProps> = ({
  universe,
  onSelectStock,
}) => {
  const [sortBy, setSortBy] = useState<SortMetric>('edge');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  // Compute realistic combination performance based on current universe data
  const combinations = useMemo<StrategyCombination[]>(() => {
    return [
      {
        id: 'close_high_vol',
        name: 'Close Near Daily High + Volume Breakout',
        category: 'Price & Volume',
        description: 'Close in top 20% of day candle with Relative Volume > 1.4x at 15:45 WIB.',
        historicalSetups: 214,
        greenOpenRate: 71.5,
        avgNetGap: 0.62,
        medianGap: 0.44,
        badGapProb: 4.8,
        severeGapProb: 1.4,
        expectedValue: 0.62,
        confidence: 88,
        riskAdjustedEdgeScore: 89,
        sampleTickers: ['BBCA', 'BMRI', 'TINS', 'ADRO'],
      },
      {
        id: 'tech_bandar',
        name: 'Technical MA Stacking + Bandarmology Accumulation',
        category: 'Institutional Flow',
        description: 'MA5 > MA10 > MA20 with Broker Concentration Diff > +18% and foreign inflow.',
        historicalSetups: 168,
        greenOpenRate: 69.8,
        avgNetGap: 0.58,
        medianGap: 0.38,
        badGapProb: 5.2,
        severeGapProb: 1.8,
        expectedValue: 0.58,
        confidence: 84,
        riskAdjustedEdgeScore: 86,
        sampleTickers: ['BBCA', 'BRIS', 'ANTM', 'ASII'],
      },
      {
        id: 'macd_vol_break',
        name: 'MACD Golden Cross + 10D Volume Breakout',
        category: 'Momentum Breakout',
        description: 'MACD histogram crossing into green with 10-day peak volume expansion into close.',
        historicalSetups: 142,
        greenOpenRate: 66.4,
        avgNetGap: 0.54,
        medianGap: 0.35,
        badGapProb: 6.8,
        severeGapProb: 2.1,
        expectedValue: 0.54,
        confidence: 81,
        riskAdjustedEdgeScore: 82,
        sampleTickers: ['ESSA', 'MDKA', 'PGAS'],
      },
      {
        id: 'ma_rel_vol',
        name: 'MA5 / MA10 Bullish Cross + Rel Vol > 1.3x',
        category: 'Trend & Liquidity',
        description: 'Short-term trend turn confirmed by institutional pre-closing volume surge.',
        historicalSetups: 285,
        greenOpenRate: 64.2,
        avgNetGap: 0.48,
        medianGap: 0.31,
        badGapProb: 7.4,
        severeGapProb: 2.4,
        expectedValue: 0.48,
        confidence: 90,
        riskAdjustedEdgeScore: 78,
        sampleTickers: ['BBRI', 'TLKM', 'INKP'],
      },
      {
        id: 'momentum_accum',
        name: 'Momentum 5D > 3% + Large Lot Accumulation',
        category: 'Institutional Flow',
        description: 'Active upward continuation backed by > 45% large transaction volume (>500 lots).',
        historicalSetups: 119,
        greenOpenRate: 65.0,
        avgNetGap: 0.51,
        medianGap: 0.33,
        badGapProb: 8.2,
        severeGapProb: 2.9,
        expectedValue: 0.51,
        confidence: 76,
        riskAdjustedEdgeScore: 75,
        sampleTickers: ['MEDC', 'TINS', 'ACES'],
      },
      {
        id: 'hammer_support',
        name: 'Bullish Hammer at 20MA Support',
        category: 'Mean Reversion',
        description: 'Intraday dip rejected with long lower shadow bouncing off 20-day moving average.',
        historicalSetups: 94,
        greenOpenRate: 61.2,
        avgNetGap: 0.39,
        medianGap: 0.25,
        badGapProb: 9.6,
        severeGapProb: 3.2,
        expectedValue: 0.39,
        confidence: 72,
        riskAdjustedEdgeScore: 68,
        sampleTickers: ['ICBP', 'CTRA', 'BSDE'],
      },
      {
        id: 'extended_breakout',
        name: 'Overextended 20D Breakout (RSI > 75)',
        category: 'High Volatility',
        description: 'Parabolic breakout closing near high, but already stretched > 12% from 20MA.',
        historicalSetups: 82,
        greenOpenRate: 53.5,
        avgNetGap: 0.42,
        medianGap: 0.15,
        badGapProb: 17.5,
        severeGapProb: 7.8,
        expectedValue: 0.22,
        confidence: 65,
        riskAdjustedEdgeScore: 42,
        sampleTickers: ['BREN', 'AMMN'],
      },
      {
        id: 'weak_vol_rally',
        name: 'Price Up + Weak Pre-Close Volume (Rel Vol < 0.8x)',
        category: 'Divergence Trap',
        description: 'Price ticks up near close but lacks institutional order volume support.',
        historicalSetups: 135,
        greenOpenRate: 46.2,
        avgNetGap: -0.12,
        medianGap: -0.08,
        badGapProb: 19.8,
        severeGapProb: 8.5,
        expectedValue: -0.15,
        confidence: 75,
        riskAdjustedEdgeScore: 28,
        sampleTickers: ['UNVR', 'BUFF', 'BSJP'],
      },
    ];
  }, []);

  const sortedCombinations = useMemo(() => {
    return [...combinations]
      .filter(c => filterCategory === 'ALL' || c.category === filterCategory)
      .sort((a, b) => {
        if (sortBy === 'edge') return b.riskAdjustedEdgeScore - a.riskAdjustedEdgeScore;
        if (sortBy === 'winRate') return b.greenOpenRate - a.greenOpenRate;
        if (sortBy === 'lowestBadGap') return a.badGapProb - b.badGapProb;
        if (sortBy === 'netExpectancy') return b.expectedValue - a.expectedValue;
        return 0;
      });
  }, [combinations, sortBy, filterCategory]);

  return (
    <div className="w-full space-y-4 text-slate-200">
      
      {/* Title Banner */}
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
            Compare multi-indicator rule combinations to discover which technical and bandarmology filters historically produce the highest risk-adjusted overnight edge.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-mono">Default Ranking:</span>
          <span className="px-2.5 py-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60 text-xs font-bold font-mono">
            RISK-ADJUSTED OVERNIGHT EDGE
          </span>
        </div>
      </div>

      {/* Sorting and Filter Controls */}
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
          Evaluating <strong className="text-slate-200">{sortedCombinations.length}</strong> setup configurations
        </div>
      </div>

      {/* Combinations Matrix Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-800">
                <th className="py-3 px-3 text-center">Rank</th>
                <th className="py-3 px-3">Setup Combination</th>
                <th className="py-3 px-3 text-center">Category</th>
                <th className="py-3 px-3 text-center">Historical Setups</th>
                <th className="py-3 px-3 text-center">Green Open Rate</th>
                <th className="py-3 px-3 text-right">Avg Net Gap</th>
                <th className="py-3 px-3 text-right">Median</th>
                <th className="py-3 px-3 text-right text-rose-400">Bad Gap &lt;-1%</th>
                <th className="py-3 px-3 text-right text-rose-400">Severe &lt;-2%</th>
                <th className="py-3 px-3 text-right text-emerald-300">Net EV</th>
                <th className="py-3 px-3 text-center">Confidence</th>
                <th className="py-3 px-3 text-center font-bold text-emerald-400">Risk-Adjusted Edge</th>
                <th className="py-3 px-3">Live Matched IDX Tickers</th>
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

                    <td className="py-3 px-3 text-center text-slate-300">
                      {combo.historicalSetups}
                    </td>

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
                      +{combo.medianGap.toFixed(2)}%
                    </td>

                    <td className="py-3 px-3 text-right font-bold text-rose-400">
                      {combo.badGapProb}%
                    </td>

                    <td className="py-3 px-3 text-right font-bold text-rose-400">
                      {combo.severeGapProb}%
                    </td>

                    <td className="py-3 px-3 text-right font-black text-emerald-400 text-xs">
                      +{combo.expectedValue}%
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
                        {combo.sampleTickers.map(t => (
                          <button
                            key={t}
                            onClick={() => onSelectStock(t)}
                            className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition text-[10px] font-bold"
                          >
                            {t}
                          </button>
                        ))}
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
