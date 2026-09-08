import React, { useState, useMemo } from 'react';
import { 
  Trophy, 
  BarChart3, 
  TrendingUp, 
  ShieldAlert, 
  Settings2, 
  Layers, 
  Zap, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Sliders, 
  Clock,
  ArrowUpRight,
  Sparkles,
  Info
} from 'lucide-react';
import { StockData } from '../types';
import { getAllStrategies, getStrategyById } from '../engine/strategies';
import { StrategyEngine, StrategyBacktestResult, MarketRegime } from '../engine/strategyTypes';
import { computeEnsembleConsensus } from '../engine/quantLabEngine';
import { StockQuantProfileModal } from './StockQuantProfileModal';

interface StrategyLeaderboardViewProps {
  universe: StockData[];
  onSelectStock: (ticker: string) => void;
  onAddToJournal: (stock: StockData) => void;
}

export const StrategyLeaderboardView: React.FC<StrategyLeaderboardViewProps> = ({
  universe,
  onSelectStock,
  onAddToJournal,
}) => {
  const strategies = useMemo(() => getAllStrategies(), []);
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>(strategies[0].id);
  const [activeTab, setActiveTab] = useState<'LEADERBOARD' | 'ENSEMBLE' | 'INSPECTOR'>('LEADERBOARD');
  const [profileStock, setProfileStock] = useState<StockData | null>(null);

  // Strategy Backtest Results Cache
  const backtestResults = useMemo(() => {
    return strategies.map(strat => {
      const res = strat.backtest(universe);
      return {
        strategy: strat,
        result: res,
      };
    });
  }, [universe, strategies]);

  const selectedBacktest = useMemo(() => {
    return backtestResults.find(b => b.strategy.id === selectedStrategyId) || backtestResults[0];
  }, [backtestResults, selectedStrategyId]);

  // Ensemble evaluation for all stocks
  const ensembleRanking = useMemo(() => {
    return universe.map(stock => {
      const consensus = computeEnsembleConsensus(stock, strategies);
      return {
        stock,
        consensus,
      };
    }).sort((a, b) => b.consensus.consensusScore - a.consensus.consensusScore);
  }, [universe, strategies]);

  const sortedLeaderboard = useMemo(() => {
    return [...backtestResults].sort((a, b) => {
      // Sort by Profit Factor * WinRate
      const scoreA = a.result.profitFactor * (a.result.winRate / 100);
      const scoreB = b.result.profitFactor * (b.result.winRate / 100);
      return scoreB - scoreA;
    });
  }, [backtestResults]);

  return (
    <div className="w-full space-y-4 text-slate-100">
      
      {/* Sub-navigation bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Multi-Strategy Quant Leaderboard & Ensemble</h1>
            <p className="text-xs text-slate-400">
              Cross-strategy comparative performance, walk-forward validation, 1,000-run Monte Carlo simulations, and decorrelated consensus.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-lg text-xs font-mono">
          <button
            onClick={() => setActiveTab('LEADERBOARD')}
            className={`px-3 py-1.5 rounded-md font-semibold transition ${
              activeTab === 'LEADERBOARD' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Strategy Leaderboard ({strategies.length})
          </button>
          <button
            onClick={() => setActiveTab('ENSEMBLE')}
            className={`px-3 py-1.5 rounded-md font-semibold transition ${
              activeTab === 'ENSEMBLE' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Ensemble Consensus ({ensembleRanking.length})
          </button>
          <button
            onClick={() => setActiveTab('INSPECTOR')}
            className={`px-3 py-1.5 rounded-md font-semibold transition ${
              activeTab === 'INSPECTOR' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Strategy Deep Dive & Monte Carlo
          </button>
        </div>
      </div>

      {/* TAB 1: LEADERBOARD VIEW */}
      {activeTab === 'LEADERBOARD' && (
        <div className="space-y-6">
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-sm">Quantitative Strategy Performance Matrix</span>
              </div>
              <span className="text-xs text-slate-400 font-mono">Ranked by Risk-Adjusted Edge</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <th className="py-3 px-4">Rank & Strategy</th>
                    <th className="py-3 px-3">Session</th>
                    <th className="py-3 px-3 text-right">Trades</th>
                    <th className="py-3 px-3 text-right">Win Rate</th>
                    <th className="py-3 px-3 text-right">Profit Factor</th>
                    <th className="py-3 px-3 text-right">Avg Return</th>
                    <th className="py-3 px-3 text-right">Max DD</th>
                    <th className="py-3 px-3 text-right">Sharpe</th>
                    <th className="py-3 px-3 text-right">VaR (95%)</th>
                    <th className="py-3 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {sortedLeaderboard.map((item, idx) => {
                    const r = item.result;
                    const isSelected = item.strategy.id === selectedStrategyId;

                    return (
                      <tr 
                        key={item.strategy.id}
                        className={`hover:bg-slate-800/40 transition cursor-pointer ${
                          isSelected ? 'bg-emerald-950/20' : ''
                        }`}
                        onClick={() => {
                          setSelectedStrategyId(item.strategy.id);
                          setActiveTab('INSPECTOR');
                        }}
                      >
                        <td className="py-3.5 px-4 font-sans">
                          <div className="flex items-center gap-2.5">
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center font-mono text-[10px] font-bold ${
                              idx === 0 ? 'bg-amber-500 text-slate-950' :
                              idx === 1 ? 'bg-slate-300 text-slate-950' :
                              idx === 2 ? 'bg-amber-700 text-white' : 'bg-slate-800 text-slate-400'
                            }`}>
                              {idx + 1}
                            </span>
                            <div>
                              <div className="font-bold text-slate-100 text-sm">{item.strategy.name}</div>
                              <div className="text-[11px] text-slate-400 font-mono">{item.strategy.holdingPeriod}</div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.strategy.operationalSession === 'AM_SESSION'
                              ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40'
                              : 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                          }`}>
                            {item.strategy.operationalSession === 'AM_SESSION' ? '09:00 AM' : '15:45 PM'}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-right text-slate-300 font-bold">{r.totalTrades}</td>
                        
                        <td className="py-3 px-3 text-right">
                          <span className="text-emerald-400 font-bold">{r.winRate}%</span>
                        </td>

                        <td className="py-3 px-3 text-right">
                          <span className={`font-bold ${r.profitFactor >= 2.0 ? 'text-emerald-400' : 'text-slate-200'}`}>
                            {r.profitFactor.toFixed(2)}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-right text-emerald-400 font-bold">
                          +{r.avgReturnPct}%
                        </td>

                        <td className="py-3 px-3 text-right text-rose-400">
                          -{r.maxDrawdownPct}%
                        </td>

                        <td className="py-3 px-3 text-right text-cyan-300 font-bold">
                          {r.sharpeRatio.toFixed(2)}
                        </td>

                        <td className="py-3 px-3 text-right text-amber-300">
                          -{r.var95}%
                        </td>

                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedStrategyId(item.strategy.id);
                              setActiveTab('INSPECTOR');
                            }}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] transition border border-slate-700"
                          >
                            Inspect
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
      )}

      {/* TAB 2: ENSEMBLE CONSENSUS */}
      {activeTab === 'ENSEMBLE' && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 to-slate-950 border border-slate-800 text-xs">
            <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase tracking-wider mb-1 font-mono">
              <Sparkles className="w-4 h-4" />
              Decorrelated Multi-Strategy Consensus Engine
            </div>
            <p className="text-slate-300">
              The Ensemble Engine evaluates signals across all 7 quantitative models while actively penalizing indicator collinearity. Overlapping momentum signals (e.g. RSI + MACD + Breakout) are decorrelated to prevent false overconfidence.
            </p>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <th className="py-3 px-4">Stock</th>
                    <th className="py-3 px-3 text-right">Price</th>
                    <th className="py-3 px-3 text-center">Consensus Signal</th>
                    <th className="py-3 px-3 text-right">Consensus Score</th>
                    <th className="py-3 px-3">Best Matching Model</th>
                    <th className="py-3 px-3 text-center">Active Models</th>
                    <th className="py-3 px-3">Session</th>
                    <th className="py-3 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {ensembleRanking.map(({ stock, consensus }) => {
                    const isStrong = consensus.consensusSignal === 'STRONG BUY';
                    const isBuy = consensus.consensusSignal === 'BUY';

                    return (
                      <tr key={stock.ticker} className="hover:bg-slate-800/40 transition">
                        <td className="py-3.5 px-4 font-sans">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-100 text-sm">{stock.ticker}</span>
                            <span className="text-[11px] text-slate-400 truncate max-w-[140px]">{stock.name}</span>
                          </div>
                        </td>

                        <td className="py-3 px-3 text-right">
                          <span className="text-slate-200">Rp {stock.price.toLocaleString('id-ID')}</span>
                          <span className={`block text-[10px] ${stock.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {stock.changePct >= 0 ? `+${stock.changePct}%` : `${stock.changePct}%`}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-center">
                          <span className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold ${
                            isStrong ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/50' :
                            isBuy ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40' :
                            'bg-slate-800 text-slate-400'
                          }`}>
                            {consensus.consensusSignal}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-right font-bold text-emerald-400 text-sm">
                          {consensus.consensusScore} / 100
                        </td>

                        <td className="py-3 px-3 font-sans font-medium text-slate-200">
                          {consensus.bestMatchingStrategyName}
                        </td>

                        <td className="py-3 px-3 text-center">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold text-[11px]">
                            {consensus.activeStrategiesCount} / {strategies.length}
                          </span>
                        </td>

                        <td className="py-3 px-3">
                          <span className="text-[10px] text-slate-400">
                            {consensus.recommendedSession === 'AM_SESSION' ? '09:00 AM Open' : '15:45 PM Close'}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setProfileStock(stock)}
                              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] transition border border-slate-700"
                            >
                              Profile
                            </button>
                            <button
                              onClick={() => onSelectStock(stock.ticker)}
                              className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-semibold transition"
                            >
                              Analyze
                            </button>
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
      )}

      {/* TAB 3: STRATEGY DEEP DIVE, WALK-FORWARD & MONTE CARLO */}
      {activeTab === 'INSPECTOR' && (
        <div className="space-y-6">
          
          {/* Strategy Selector Pills */}
          <div className="flex overflow-x-auto gap-2 pb-2">
            {strategies.map(s => (
              <button
                key={s.id}
                onClick={() => setSelectedStrategyId(s.id)}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition border ${
                  s.id === selectedStrategyId
                    ? 'bg-emerald-950 border-emerald-500 text-emerald-300 shadow-md'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>

          {/* Strategy Details Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <span className="text-[11px] font-mono text-emerald-400 uppercase tracking-wider">Strategy Architecture & Specs</span>
                <h2 className="text-xl font-bold text-slate-100">{selectedBacktest.strategy.name}</h2>
                <p className="text-xs text-slate-400 mt-1 max-w-2xl">{selectedBacktest.strategy.description}</p>
              </div>

              <div className="flex items-center gap-3 font-mono text-xs">
                <div className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400">Holding: </span>
                  <span className="text-slate-200 font-bold">{selectedBacktest.strategy.holdingPeriod}</span>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400">Session: </span>
                  <span className="text-cyan-300 font-bold">
                    {selectedBacktest.strategy.operationalSession === 'AM_SESSION' ? '09:00 WIB' : '15:45 WIB'}
                  </span>
                </div>
              </div>
            </div>

            {/* Backtest KPI Row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mt-4">
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-center font-mono">
                <div className="text-[10px] text-slate-400">Total Trades</div>
                <div className="text-base font-bold text-slate-100">{selectedBacktest.result.totalTrades}</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-center font-mono">
                <div className="text-[10px] text-slate-400">Win Rate</div>
                <div className="text-base font-bold text-emerald-400">{selectedBacktest.result.winRate}%</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-center font-mono">
                <div className="text-[10px] text-slate-400">Profit Factor</div>
                <div className="text-base font-bold text-slate-100">{selectedBacktest.result.profitFactor.toFixed(2)}</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-center font-mono">
                <div className="text-[10px] text-slate-400">Max Drawdown</div>
                <div className="text-base font-bold text-rose-400">-{selectedBacktest.result.maxDrawdownPct}%</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-center font-mono">
                <div className="text-[10px] text-slate-400">VaR (95%)</div>
                <div className="text-base font-bold text-amber-300">-{selectedBacktest.result.var95}%</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-center font-mono">
                <div className="text-[10px] text-slate-400">Expected Shortfall</div>
                <div className="text-base font-bold text-rose-300">-{selectedBacktest.result.expectedShortfallCVaR}%</div>
              </div>
            </div>

            {/* Walk-Forward Out-Of-Sample Validation */}
            {selectedBacktest.result.walkForward && (
              <div className="mt-6 p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-xs font-mono uppercase tracking-wider text-slate-200">
                      Walk-Forward Analysis (Strict Chronological Split)
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    Robustness Score: <strong className="text-emerald-400">{selectedBacktest.result.walkForward.robustnessScore}/100</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="text-slate-400 text-[10px] uppercase">In-Sample Training (60%)</div>
                    <div className="text-sm font-bold text-slate-200 mt-0.5">
                      Win Rate: {selectedBacktest.result.walkForward.trainWinRate}% | PF: {selectedBacktest.result.walkForward.trainProfitFactor}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Sample: {selectedBacktest.result.walkForward.trainTradesCount} trades
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="text-slate-400 text-[10px] uppercase">Cross-Validation (20%)</div>
                    <div className="text-sm font-bold text-slate-200 mt-0.5">
                      Win Rate: {selectedBacktest.result.walkForward.validateWinRate}% | PF: {selectedBacktest.result.walkForward.validateProfitFactor}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Sample: {selectedBacktest.result.walkForward.validateTradesCount} trades
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/40">
                    <div className="text-emerald-400 text-[10px] uppercase font-bold">Out-Of-Sample Test (20%)</div>
                    <div className="text-sm font-bold text-emerald-300 mt-0.5">
                      Win Rate: {selectedBacktest.result.walkForward.testWinRate}% | PF: {selectedBacktest.result.walkForward.testProfitFactor}
                    </div>
                    <div className="text-[10px] text-emerald-500 mt-0.5">
                      Sample: {selectedBacktest.result.walkForward.testTradesCount} trades (Zero lookahead)
                    </div>
                  </div>
                </div>

                {selectedBacktest.result.walkForward.isOverfitWarning && (
                  <div className="mt-3 p-2 rounded bg-rose-950/50 border border-rose-600/40 text-rose-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <span>Overfitting Warning: Out-of-sample performance degraded substantially compared to training window.</span>
                  </div>
                )}
              </div>
            )}

            {/* Monte Carlo Simulator Panel */}
            {selectedBacktest.result.monteCarlo && (
              <div className="mt-6 p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-cyan-400" />
                    <span className="font-bold text-xs font-mono uppercase tracking-wider text-slate-200">
                      Monte Carlo Simulator (1,000 Iterations Sampling with Replacement)
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    Positive Return Prob: <strong className="text-emerald-400">{selectedBacktest.result.monteCarlo.probOfPositiveReturn}%</strong>
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono mb-4">
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="text-[10px] text-slate-400">Median Final Equity</div>
                    <div className="text-sm font-bold text-emerald-400 mt-0.5">
                      {selectedBacktest.result.monteCarlo.medianFinalEquity} pts
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="text-[10px] text-slate-400">5th Percentile (Worst-Case)</div>
                    <div className="text-sm font-bold text-rose-400 mt-0.5">
                      {selectedBacktest.result.monteCarlo.p5WorstCaseEquity} pts
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="text-[10px] text-slate-400">Risk of DD &gt; 10%</div>
                    <div className="text-sm font-bold text-amber-300 mt-0.5">
                      {selectedBacktest.result.monteCarlo.probOfDrawdownOver10Pct}%
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="text-[10px] text-slate-400">Risk of DD &gt; 20%</div>
                    <div className="text-sm font-bold text-rose-400 mt-0.5">
                      {selectedBacktest.result.monteCarlo.probOfDrawdownOver20Pct}%
                    </div>
                  </div>
                </div>

                {/* SVG Visual Monte Carlo Simulation Paths */}
                <div className="h-44 w-full bg-slate-900/60 border border-slate-800 rounded-lg p-2 relative overflow-hidden flex flex-col justify-end">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 400 120" preserveAspectRatio="none">
                    {/* Baseline 100 line */}
                    <line x1="0" y1="70" x2="400" y2="70" stroke="#334155" strokeDasharray="3 3" strokeWidth="1" />
                    
                    {/* Sample Simulated Paths */}
                    {selectedBacktest.result.monteCarlo.simulatedPaths.map((path, pIdx) => {
                      const pointsStr = path.points.map((val, step) => {
                        const x = (step / (path.points.length - 1)) * 400;
                        // Map 70 to 140 scale
                        const y = Math.max(5, Math.min(115, 120 - ((val - 70) / 80) * 120));
                        return `${x},${y}`;
                      }).join(' ');

                      return (
                        <polyline
                          key={path.pathId}
                          fill="none"
                          stroke={pIdx === 0 ? '#10b981' : pIdx === 1 ? '#f43f5e' : '#0ea5e9'}
                          strokeOpacity={pIdx < 3 ? 0.8 : 0.25}
                          strokeWidth={pIdx < 3 ? 1.8 : 1}
                          points={pointsStr}
                        />
                      );
                    })}
                  </svg>
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-800/80">
                    <span>Trade #0</span>
                    <span>Monte Carlo Sample Trajectories</span>
                    <span>Trade #60</span>
                  </div>
                </div>
              </div>
            )}

            {/* Regime Breakdown */}
            <div className="mt-6">
              <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-3">
                Performance Across Market Regimes
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
                {Object.entries(selectedBacktest.result.regimeBreakdown).map(([reg, rawVal]) => {
                  const val = rawVal as { winRate: number; avgReturnPct: number; tradeCount: number };
                  return (
                    <div key={reg} className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                      <div className="text-[10px] text-slate-400 font-sans">{reg.replace('_', ' ')}</div>
                      <div className="text-sm font-bold text-slate-100 mt-1">Win Rate: {val.winRate}%</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Avg Ret: <span className="text-emerald-400">+{val.avgReturnPct}%</span> ({val.tradeCount} trades)
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Profile Modal */}
      {profileStock && (
        <StockQuantProfileModal
          stock={profileStock}
          universe={universe}
          onClose={() => setProfileStock(null)}
          onSelectStock={onSelectStock}
          onAddToJournal={onAddToJournal}
        />
      )}
    </div>
  );
};
