import React, { useState, useMemo } from 'react';
import { 
  Compass, 
  Layers, 
  Flame, 
  ShieldCheck, 
  Clock, 
  TrendingUp, 
  Filter, 
  Zap, 
  CheckCircle2, 
  AlertTriangle,
  ArrowUpRight,
  BookmarkPlus,
  BarChart3,
  Globe2
} from 'lucide-react';
import { StockData } from '../types';
import { getAllStrategies } from '../engine/strategies';
import { classifyMarketRegime, computeEnsembleConsensus } from '../engine/quantLabEngine';
import { StockQuantProfileModal } from './StockQuantProfileModal';

interface OpportunityMapViewProps {
  universe: StockData[];
  onSelectStock: (ticker: string) => void;
  onAddToJournal: (stock: StockData) => void;
}

export const OpportunityMapView: React.FC<OpportunityMapViewProps> = ({
  universe,
  onSelectStock,
  onAddToJournal,
}) => {
  const [sessionFilter, setSessionFilter] = useState<'ALL' | 'AM' | 'PM'>('ALL');
  const [strategyFilter, setStrategyFilter] = useState<string>('ALL');
  const [sectorFilter, setSectorFilter] = useState<string>('ALL');
  const [profileStock, setProfileStock] = useState<StockData | null>(null);

  const strategies = useMemo(() => getAllStrategies(), []);
  const regimeInfo = useMemo(() => classifyMarketRegime(universe), [universe]);

  // Compute ensemble and strategy evaluations for each stock
  const stockOpportunities = useMemo(() => {
    return universe.map(stock => {
      const ensemble = computeEnsembleConsensus(stock, strategies);
      const strategyScores = strategies.map(strat => ({
        strategy: strat,
        scoreResult: strat.score(stock),
      }));

      // Top strategy
      const topStrat = [...strategyScores].sort((a, b) => b.scoreResult.score - a.scoreResult.score)[0];

      return {
        stock,
        ensemble,
        topStrategy: topStrat.strategy,
        topScoreResult: topStrat.scoreResult,
        allScores: strategyScores,
      };
    });
  }, [universe, strategies]);

  // Filter opportunities
  const filteredOpportunities = useMemo(() => {
    return stockOpportunities.filter(item => {
      // Session filter
      if (sessionFilter === 'AM' && item.topStrategy.operationalSession === 'PM_SESSION') return false;
      if (sessionFilter === 'PM' && item.topStrategy.operationalSession === 'AM_SESSION') return false;

      // Strategy filter
      if (strategyFilter !== 'ALL' && item.topStrategy.id !== strategyFilter) return false;

      // Sector filter
      if (sectorFilter !== 'ALL' && item.stock.sector !== sectorFilter) return false;

      // Show actionable candidates (score >= 50 or signal BUY/STRONG BUY/WATCH)
      return item.topScoreResult.score >= 45;
    }).sort((a, b) => b.topScoreResult.score - a.topScoreResult.score);
  }, [stockOpportunities, sessionFilter, strategyFilter, sectorFilter]);

  const uniqueSectors = useMemo(() => {
    return Array.from(new Set(universe.map(s => s.sector))).sort();
  }, [universe]);

  // Summary Metrics
  const strongBuyCount = filteredOpportunities.filter(o => o.topScoreResult.signal === 'STRONG BUY').length;
  const buyCount = filteredOpportunities.filter(o => o.topScoreResult.signal === 'BUY').length;
  const avgExpReturn = filteredOpportunities.length > 0 
    ? (filteredOpportunities.reduce((acc, o) => acc + o.topScoreResult.expectedReturnPct, 0) / filteredOpportunities.length).toFixed(1)
    : '0';

  return (
    <div className="w-full space-y-4 text-slate-100">
      
      {/* Macro Regime Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800 rounded-xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Globe2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">Macro Market Regime</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950 border border-emerald-500/40 text-emerald-300">
                  {regimeInfo.regime}
                </span>
              </div>
              <h1 className="text-lg font-bold text-slate-100">{regimeInfo.regimeLabel}</h1>
            </div>
          </div>

          {/* Key Macro Stats */}
          <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
            <div className="px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700">
              <span className="text-slate-400">Stocks &gt; MA50: </span>
              <span className="text-emerald-400 font-bold">{regimeInfo.stocksAboveMa50Pct}%</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700">
              <span className="text-slate-400">Average ADX: </span>
              <span className="text-cyan-400 font-bold">{regimeInfo.averageAdx}</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700">
              <span className="text-slate-400">Foreign Net Flow: </span>
              <span className={regimeInfo.netForeignFlowSumIDR >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                {regimeInfo.netForeignFlowSumIDR >= 0 ? '+' : ''}{(regimeInfo.netForeignFlowSumIDR / 1e9).toFixed(1)}B IDR
              </span>
            </div>
          </div>
        </div>

        {/* Regime Recommended Playbook */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400 font-mono">Favorable Quantitative Playbooks:</span>
          {regimeInfo.favorableStrategies.map((strat, i) => (
            <span key={i} className="px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 font-semibold text-[11px]">
              {strat}
            </span>
          ))}
        </div>
      </div>

      {/* Control Bar: Session Switcher & Filters */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        
        {/* AM / PM Operational Workflow Buttons */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => setSessionFilter('ALL')}
            className={`px-3 py-1.5 rounded-md font-semibold transition ${
              sessionFilter === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Workflows ({filteredOpportunities.length})
          </button>
          <button
            onClick={() => setSessionFilter('AM')}
            className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition ${
              sessionFilter === 'AM' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            09:00 AM Session (Intraday & Open)
          </button>
          <button
            onClick={() => setSessionFilter('PM')}
            className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition ${
              sessionFilter === 'PM' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            15:45 PM Session (Overnight & Swing)
          </button>
        </div>

        {/* Strategy Dropdown & Sector Filter */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-mono">Strategy:</span>
            <select
              value={strategyFilter}
              onChange={(e) => setStrategyFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
            >
              <option value="ALL">All 7 Strategies</option>
              {strategies.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-mono">Sector:</span>
            <select
              value={sectorFilter}
              onChange={(e) => setSectorFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
            >
              <option value="ALL">All Sectors</option>
              {uniqueSectors.map(sec => (
                <option key={sec} value={sec}>{sec}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary KPI Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="text-[11px] font-mono text-slate-400 uppercase">Actionable Setups</div>
          <div className="text-2xl font-bold font-mono text-slate-100 mt-0.5">{filteredOpportunities.length}</div>
        </div>
        <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30">
          <div className="text-[11px] font-mono text-emerald-400 uppercase">Strong Conviction</div>
          <div className="text-2xl font-bold font-mono text-emerald-300 mt-0.5">{strongBuyCount}</div>
        </div>
        <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/30">
          <div className="text-[11px] font-mono text-cyan-400 uppercase">Buy Setups</div>
          <div className="text-2xl font-bold font-mono text-cyan-300 mt-0.5">{buyCount}</div>
        </div>
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="text-[11px] font-mono text-slate-400 uppercase">Avg Expected Return</div>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-0.5">+{avgExpReturn}%</div>
        </div>
      </div>

      {/* Opportunity Grid / Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredOpportunities.map(({ stock, ensemble, topStrategy, topScoreResult }) => {
          const isStrong = topScoreResult.signal === 'STRONG BUY';
          const isBuy = topScoreResult.signal === 'BUY';

          return (
            <div
              key={stock.ticker}
              className={`rounded-xl border transition-all flex flex-col justify-between p-4 ${
                isStrong 
                  ? 'bg-gradient-to-b from-slate-900 to-slate-950 border-emerald-500/50 shadow-lg shadow-emerald-950/20' 
                  : isBuy
                  ? 'bg-slate-900/80 border-slate-700/80 hover:border-slate-600'
                  : 'bg-slate-900/50 border-slate-800/70 opacity-90'
              }`}
            >
              <div>
                {/* Header: Ticker & Conviction Pill */}
                <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={() => setProfileStock(stock)}
                      className="w-10 h-10 rounded-lg bg-slate-950 border border-slate-700 flex items-center justify-center font-mono font-bold text-sm text-emerald-400 hover:border-emerald-400 transition"
                      title="View Quant Profile"
                    >
                      {stock.ticker}
                    </button>
                    <div>
                      <div className="font-bold text-slate-100 text-sm leading-tight flex items-center gap-1.5">
                        {stock.ticker}
                        <span className="text-[10px] font-mono text-slate-400 font-normal">
                          {stock.sector}
                        </span>
                      </div>
                      <div className="text-xs font-mono text-slate-300 mt-0.5">
                        Rp {stock.price.toLocaleString('id-ID')}
                        <span className={`ml-2 font-semibold ${stock.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {stock.changePct >= 0 ? `+${stock.changePct}%` : `${stock.changePct}%`}
                        </span>
                      </div>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-extrabold ${
                    isStrong 
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/50' 
                      : isBuy
                      ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40'
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {topScoreResult.signal}
                  </span>
                </div>

                {/* Best Matching Strategy Callout */}
                <div className="mt-3 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                  <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Zap className="w-3 h-3 text-amber-400" />
                      Best Strategy Match:
                    </span>
                    <span className="text-emerald-400 font-bold">{topScoreResult.score}/100</span>
                  </div>
                  <div className="text-xs font-bold text-slate-200 font-sans">
                    {topStrategy.name}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Hold: {topStrategy.holdingPeriod}
                  </div>
                </div>

                {/* Quant Multi-Metrics */}
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-mono">
                  <div className="p-2 rounded bg-slate-950/40 border border-slate-800/60">
                    <div className="text-[10px] text-slate-400">Win Rate</div>
                    <div className="font-bold text-slate-200">{topScoreResult.winRate}%</div>
                  </div>
                  <div className="p-2 rounded bg-slate-950/40 border border-slate-800/60">
                    <div className="text-[10px] text-slate-400">Exp. Return</div>
                    <div className="font-bold text-emerald-400">+{topScoreResult.expectedReturnPct}%</div>
                  </div>
                  <div className="p-2 rounded bg-slate-950/40 border border-slate-800/60">
                    <div className="text-[10px] text-slate-400">Tail Safety</div>
                    <div className={`font-bold ${topScoreResult.tailRiskScore >= 75 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {topScoreResult.tailRiskScore}/100
                    </div>
                  </div>
                </div>

                {/* Positive Reason */}
                <div className="mt-3 text-[11px] text-slate-300">
                  <div className="flex items-start gap-1 text-slate-400">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{topScoreResult.positiveFactors[0] || 'Technical and volume structure aligned'}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                <button
                  onClick={() => setProfileStock(stock)}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition border border-slate-700"
                >
                  Quant Profile
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onAddToJournal(stock)}
                    title="Log to Morning Exit Journal"
                    className="p-1.5 rounded bg-emerald-950/50 hover:bg-emerald-900 text-emerald-400 border border-emerald-500/30 transition"
                  >
                    <BookmarkPlus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onSelectStock(stock.ticker)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition"
                  >
                    Analyze
                    <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Stock Quant Profile Modal */}
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
