import React, { useState } from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  Sparkles, 
  PlusCircle, 
  TrendingUp, 
  Sliders, 
  Eye, 
  CheckCircle2, 
  ChevronDown,
  ChevronUp,
  Cpu,
  ArrowUpRight,
  ShieldAlert,
  HelpCircle
} from 'lucide-react';
import { StockData, DecisionCategory } from '../types';
import { FinalDecisionModal } from './FinalDecisionModal';
import { QuantMLEnsembleEngine } from '../engine/ml/ensembleRouter';

interface FinalShortlistViewProps {
  universe: StockData[];
  onSelectStock: (ticker: string) => void;
  onAddToJournal: (stock: StockData) => void;
  onOpenSettings: () => void;
}

export const FinalShortlistView: React.FC<FinalShortlistViewProps> = ({
  universe,
  onSelectStock,
  onAddToJournal,
  onOpenSettings,
}) => {
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [decisionModalStock, setDecisionModalStock] = useState<StockData | null>(null);

  // Filter and sort for the 15:45 Final Shortlist:
  // Must have passed prefilter and score >= 50, sorted strictly by Overnight Edge Score
  const candidates = React.useMemo(() => {
    return [...universe]
      .filter(s => s.prefilterPassed && s.overnightEdgeScore >= 50)
      .sort((a, b) => b.overnightEdgeScore - a.overnightEdgeScore)
      .slice(0, 10);
  }, [universe]);

  const topPick = candidates[0];
  const topEnsemble = topPick ? QuantMLEnsembleEngine.evaluate(topPick) : null;

  const getDecisionBadge = (decision: DecisionCategory) => {
    switch (decision) {
      case 'STRONG BUY':
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-500/80 ring-1 ring-emerald-400/40';
      case 'BUY':
        return 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60';
      case 'WATCH':
        return 'bg-amber-950/60 text-amber-300 border-amber-600/60';
      case 'SKIP':
        return 'bg-slate-800 text-slate-400 border-slate-700';
      case 'AVOID':
        return 'bg-rose-950/60 text-rose-300 border-rose-700/60';
    }
  };

  const getQualityBadge = (quality: StockData['quality']) => {
    switch (quality) {
      case 'ELITE':
        return 'bg-cyan-950/80 text-cyan-300 border-cyan-700/60';
      case 'HIGH':
        return 'bg-slate-800/80 text-slate-300 border-slate-700';
      case 'MEDIUM':
        return 'bg-amber-950/60 text-amber-400 border-amber-800/60';
      default:
        return 'bg-rose-950/60 text-rose-300 border-rose-800/60';
    }
  };

  return (
    <div className="w-full space-y-4 text-slate-100">
      
      {/* 15:45 Execution Desk Header */}
      <div className="bg-[#101B2D] border border-[#22304A] rounded-md p-4 shadow-sm">
        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 text-xs font-bold tracking-wider uppercase">
                15:45 WIB SHORTLIST
              </span>
              <span className="text-xs text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded bg-emerald-950/50">
                PRE-CLOSE AUCTION EXECUTION DESK
              </span>
            </div>
            <h1 className="text-xl font-semibold text-slate-100 tracking-tight">
              Pre-Closing Execution Matrix: Buy-Close / Sell-Open
            </h1>
            <p className="text-xs text-slate-400 max-w-3xl mt-1 leading-relaxed">
              15:45 Decision: Which stocks offer the strongest risk-adjusted overnight edge? Filtered to maximize <span className="text-emerald-400 font-medium">Green Open Probability</span> while severely penalizing <span className="text-rose-400 font-medium">Opening Gap-Down Tail Risk</span>.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full xl:w-auto justify-start xl:justify-end">
            <button
              onClick={onOpenSettings}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0D1727] hover:bg-[#1A263C] text-slate-300 hover:text-white rounded border border-[#22304A] text-xs font-medium transition"
            >
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              Tune Scoring Weights
            </button>
          </div>
        </div>
      </div>

      {/* Prominent Unified Decision Panel for #1 Conviction Setup */}
      {topPick && topEnsemble && (
        <div className="bg-[#0D1727] border border-[#22304A] rounded-md p-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-[#1A263C] pb-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Unified Quant + ML Decision Panel • Rank #1 Conviction Setup
              </h2>
            </div>
            <span className="text-[11px] text-slate-400">
              Primary Strategy: <strong className="text-emerald-400 font-semibold">Overnight Edge (Buy-Close / Sell-Open)</strong>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-3">
            {/* Ticker & Quote */}
            <div className="bg-[#101B2D] border border-[#1A263C] rounded p-2.5">
              <div className="text-[11px] text-slate-400 uppercase">Ticker / Price</div>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-lg font-bold text-slate-100">{topPick.ticker}</span>
                <span className="text-xs text-emerald-400 font-mono">+{topPick.changePct}%</span>
              </div>
              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                Rp {topPick.price.toLocaleString('id-ID')}
              </div>
            </div>

            {/* Final Edge */}
            <div className="bg-[#101B2D] border border-[#1A263C] rounded p-2.5">
              <div className="text-[11px] text-slate-400 uppercase">Final Edge Score</div>
              <div className="text-2xl font-bold text-emerald-400 mt-0.5">
                {topEnsemble.finalQuantMLEdge} <span className="text-xs font-normal text-slate-400">/ 100</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Quant: <span className="text-slate-200 font-mono font-medium">{topEnsemble.quantRuleScore}</span>
              </div>
            </div>

            {/* ML Probability */}
            <div className="bg-[#101B2D] border border-[#1A263C] rounded p-2.5">
              <div className="text-[11px] text-slate-400 uppercase">ML Green Open Prob</div>
              <div className="text-2xl font-bold text-cyan-400 mt-0.5 font-mono">
                {topEnsemble.mlProbability}%
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Hist Rate: <span className="text-slate-200 font-mono">{topPick.historicalStats.greenOpenRate}%</span>
              </div>
            </div>

            {/* Gap Down Risk */}
            <div className="bg-[#101B2D] border border-[#1A263C] rounded p-2.5">
              <div className="text-[11px] text-slate-400 uppercase">Gap Down Risk</div>
              <div className={`text-lg font-bold mt-0.5 ${
                topEnsemble.tailRiskLevel === 'LOW' ? 'text-emerald-400' :
                topEnsemble.tailRiskLevel === 'MODERATE' ? 'text-amber-400' : 'text-rose-400'
              }`}>
                {topEnsemble.tailRiskLevel}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                Severe &lt;-2%: {topPick.historicalStats.severeGap2PctProb}%
              </div>
            </div>

            {/* System Confidence */}
            <div className="bg-[#101B2D] border border-[#1A263C] rounded p-2.5">
              <div className="text-[11px] text-slate-400 uppercase">Confidence</div>
              <div className="text-lg font-bold text-slate-200 mt-0.5">
                {topEnsemble.confidence}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                Score: {topEnsemble.confidenceScore} / 100
              </div>
            </div>

            {/* System Decision */}
            <div className="bg-[#101B2D] border border-emerald-500/40 rounded p-2.5 flex flex-col justify-between">
              <div>
                <div className="text-[11px] text-slate-400 uppercase">System Decision</div>
                <div className="text-sm font-bold text-emerald-300 mt-0.5 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  {topEnsemble.systemDecision}
                </div>
              </div>
              <button
                onClick={() => setDecisionModalStock(topPick)}
                className="w-full mt-2 py-1 px-2 rounded bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/40 text-[11px] font-semibold transition flex items-center justify-center gap-1"
              >
                <Cpu className="w-3 h-3 text-cyan-400" />
                <span>Explain Verdict</span>
              </button>
            </div>
          </div>

          {/* Rationale & Execution Plan */}
          <div className="bg-[#101B2D] border border-[#1A263C] rounded p-3 text-xs text-slate-300 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                Decision Rationale & Consensus:
              </div>
              <div className="text-slate-200">
                {topEnsemble.agreementDetails} {topEnsemble.decisionRationale[0]}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => onSelectStock(topPick.ticker)}
                className="px-3 py-1.5 rounded bg-[#0D1727] hover:bg-[#1A263C] text-slate-200 border border-[#22304A] text-xs font-medium transition"
              >
                Inspect Factors
              </button>
              <button
                onClick={() => onAddToJournal(topPick)}
                className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs transition flex items-center gap-1"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Log Position (15:45 Buy)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Shortlist Table */}
      <div className="bg-[#101B2D] border border-[#22304A] rounded-md overflow-hidden shadow-sm">
        <div className="px-4 py-2.5 bg-[#0D1727] border-b border-[#22304A] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold text-slate-200 uppercase tracking-wide">
              Ranked Overnight Candidates ({candidates.length} Stocks)
            </span>
          </div>
          <span className="text-[11px] text-slate-400">
            Sorted by <strong className="text-emerald-400 font-semibold">Overnight Edge Score</strong> (Deducting Gap-Down Penalties)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#0A1322] text-slate-400 uppercase text-[11px] tracking-wider border-b border-[#22304A] select-none sticky top-0 z-10 font-medium">
                <th className="py-2.5 px-3 text-center">Rank</th>
                <th className="py-2.5 px-3">Ticker</th>
                <th className="py-2.5 px-3 text-right">Price</th>
                <th className="py-2.5 px-3 text-right">Change</th>
                <th className="py-2.5 px-3 text-center">Sample N</th>
                <th className="py-2.5 px-3 text-center">Green Rate</th>
                <th className="py-2.5 px-3 text-right">Avg Gap</th>
                <th className="py-2.5 px-3 text-right">Median</th>
                <th className="py-2.5 px-3 text-right text-rose-400">Gap &lt;-1%</th>
                <th className="py-2.5 px-3 text-right text-rose-400">Severe &lt;-2%</th>
                <th className="py-2.5 px-3 text-right text-rose-300">Worst Gap</th>
                <th className="py-2.5 px-3 text-right">Gross Gap</th>
                <th className="py-2.5 px-3 text-right text-slate-500">Fees</th>
                <th className="py-2.5 px-3 text-right font-bold text-emerald-300">Net Gap</th>
                <th className="py-2.5 px-3 text-center">Tech</th>
                <th className="py-2.5 px-3 text-center">Inst. Flow</th>
                <th className="py-2.5 px-3 text-center text-emerald-300">Tail Safety</th>
                <th className="py-2.5 px-3 text-center font-bold text-emerald-400">Edge Score</th>
                <th className="py-2.5 px-3 text-center">Quality</th>
                <th className="py-2.5 px-3 text-center">Decision</th>
                <th className="py-2.5 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A263C]">
              {candidates.map((stock, idx) => {
                const isTop1 = idx === 0;
                const isExpanded = expandedTicker === stock.ticker;

                return (
                  <React.Fragment key={stock.ticker}>
                    <tr 
                      className={`hover:bg-[#1A263C]/60 transition cursor-pointer ${
                        isTop1 ? 'bg-emerald-950/20' : idx % 2 === 0 ? 'bg-[#101B2D]' : 'bg-[#0D1727]'
                      }`}
                      onClick={() => setExpandedTicker(isExpanded ? null : stock.ticker)}
                    >
                      {/* Rank */}
                      <td className="py-2 px-3 text-center font-mono">
                        <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-xs font-bold ${
                          idx === 0 
                            ? 'bg-emerald-500 text-slate-950' 
                            : idx === 1 
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' 
                            : 'text-slate-400'
                        }`}>
                          {idx + 1}
                        </span>
                      </td>

                      {/* Ticker */}
                      <td className="py-2 px-3">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-100 text-xs tracking-wider flex items-center gap-1">
                            {stock.ticker}
                            {isTop1 && <Sparkles className="w-3.5 h-3.5 text-amber-400 inline" />}
                          </span>
                          <span className="text-[11px] text-slate-400 truncate max-w-[120px]">
                            {stock.name}
                          </span>
                        </div>
                      </td>

                      {/* Price */}
                      <td className="py-2 px-3 text-right font-mono font-medium text-slate-100">
                        Rp {stock.price.toLocaleString('id-ID')}
                      </td>

                      {/* Live % */}
                      <td className="py-2 px-3 text-right font-mono font-medium text-emerald-400">
                        +{stock.changePct.toFixed(2)}%
                      </td>

                      {/* Historical Setups */}
                      <td className="py-2 px-3 text-center font-mono">
                        <span className="px-1.5 py-0.5 rounded bg-[#1A263C] text-slate-300 text-[11px]">
                          {stock.historicalStats.comparableSetupsCount}
                        </span>
                      </td>

                      {/* Green Open Rate */}
                      <td className="py-2 px-3 text-center font-mono">
                        <span className={`px-2 py-0.5 rounded font-bold text-xs ${
                          stock.historicalStats.greenOpenRate >= 68
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-600/50'
                            : stock.historicalStats.greenOpenRate >= 60
                            ? 'bg-emerald-950/60 text-emerald-400'
                            : 'text-slate-300'
                        }`}>
                          {stock.historicalStats.greenOpenRate.toFixed(1)}%
                        </span>
                      </td>

                      {/* Avg Gap */}
                      <td className="py-2 px-3 text-right font-mono font-medium text-slate-200">
                        +{stock.historicalStats.avgOvernightGap.toFixed(2)}%
                      </td>

                      {/* Median Gap */}
                      <td className="py-2 px-3 text-right font-mono text-slate-300">
                        +{stock.historicalStats.medianOvernightGap.toFixed(2)}%
                      </td>

                      {/* Bad Gap < -1% */}
                      <td className="py-2 px-3 text-right font-mono font-medium">
                        <span className={`${
                          stock.historicalStats.badGap1PctProb <= 6
                            ? 'text-emerald-400'
                            : stock.historicalStats.badGap1PctProb <= 12
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }`}>
                          {stock.historicalStats.badGap1PctProb.toFixed(1)}%
                        </span>
                      </td>

                      {/* Severe Gap < -2% */}
                      <td className="py-2 px-3 text-right font-mono font-medium">
                        <span className={`${
                          stock.historicalStats.severeGap2PctProb <= 2.5
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                        }`}>
                          {stock.historicalStats.severeGap2PctProb.toFixed(1)}%
                        </span>
                      </td>

                      {/* Worst Historical Gap */}
                      <td className="py-2 px-3 text-right text-rose-400 font-mono">
                        {stock.historicalStats.worstGap.toFixed(1)}%
                      </td>

                      {/* Expected Gross Gap */}
                      <td className="py-2 px-3 text-right text-slate-300 font-mono">
                        +{stock.expectedGrossGap.toFixed(2)}%
                      </td>

                      {/* Estimated Fee */}
                      <td className="py-2 px-3 text-right text-slate-500 font-mono">
                        -{stock.estimatedFee.toFixed(2)}%
                      </td>

                      {/* Expected Net Gap */}
                      <td className="py-2 px-3 text-right font-bold text-emerald-400 font-mono text-xs">
                        +{stock.expectedNetGap.toFixed(2)}%
                      </td>

                      {/* Tech Score */}
                      <td className="py-2 px-3 text-center text-slate-300 font-mono">
                        {stock.technicalScore}
                      </td>

                      {/* Bandarmology Score */}
                      <td className="py-2 px-3 text-center font-mono">
                        <span className={`${stock.bandarmologyScore >= 75 ? 'text-emerald-400 font-bold' : 'text-slate-300'}`}>
                          {stock.bandarmologyScore}
                        </span>
                      </td>

                      {/* Tail Risk Score */}
                      <td className="py-2 px-3 text-center font-mono">
                        <span className="px-1.5 py-0.5 rounded font-bold bg-[#1A263C] text-emerald-400 border border-emerald-900/40">
                          {stock.tailRiskScore}
                        </span>
                      </td>

                      {/* Overnight Edge Score */}
                      <td className="py-2 px-3 text-center font-mono">
                        <span className="px-2 py-0.5 rounded font-bold text-xs bg-emerald-500 text-slate-950">
                          {stock.overnightEdgeScore}
                        </span>
                      </td>

                      {/* Quality */}
                      <td className="py-2 px-3 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${getQualityBadge(stock.quality)}`}>
                          {stock.quality}
                        </span>
                      </td>

                      {/* Decision */}
                      <td className="py-2 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase border ${getDecisionBadge(stock.decision)}`}>
                          {stock.decision}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-2 px-3 text-center" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setDecisionModalStock(stock)}
                            title="Open Unified Quant + ML Decision Verdict"
                            className="p-1 rounded bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/40 transition"
                          >
                            <Cpu className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onSelectStock(stock.ticker)}
                            title="Open Detailed Stock Analysis"
                            className="p-1 rounded bg-[#1A263C] hover:bg-slate-700 text-slate-300 hover:text-white transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onAddToJournal(stock)}
                            title="Log to Morning Exit Journal"
                            className="p-1 rounded bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/50 transition flex items-center gap-1 text-[11px] font-medium"
                          >
                            <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="hidden xl:inline">Buy</span>
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expandable Breakdown Drawer */}
                    {isExpanded && (
                      <tr className="bg-[#0A1322] border-b border-[#22304A]">
                        <td colSpan={21} className="p-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                            {/* Factor Breakdown */}
                            <div className="space-y-2 bg-[#101B2D] p-3 rounded border border-[#22304A]">
                              <h4 className="font-semibold text-slate-200 flex items-center gap-1.5 text-xs">
                                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                                Why Ranked Here: Positive Drivers
                              </h4>
                              <ul className="space-y-1 text-slate-300 text-[11px]">
                                {stock.positiveFactors.map((f, i) => (
                                  <li key={i} className="flex items-start gap-1.5">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                    <span>{f}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>

                            {/* Risk Watchouts */}
                            <div className="space-y-2 bg-[#101B2D] p-3 rounded border border-[#22304A]">
                              <h4 className="font-semibold text-rose-300 flex items-center gap-1.5 text-xs">
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                                Opening Gap Risk & Tail Watchouts
                              </h4>
                              <ul className="space-y-1 text-slate-300 text-[11px]">
                                {stock.riskFactors.map((r, i) => (
                                  <li key={i} className="flex items-start gap-1.5">
                                    <span className="text-rose-400 font-bold shrink-0">•</span>
                                    <span>{r}</span>
                                  </li>
                                ))}
                              </ul>
                              <div className="pt-2 border-t border-[#1A263C] text-[10px] text-slate-400">
                                Worst Gap in historical sample: <strong className="text-rose-400 font-mono">{stock.historicalStats.worstGap}%</strong>
                              </div>
                            </div>

                            {/* Probabilistic AI Conclusion */}
                            <div className="space-y-2 bg-emerald-950/20 p-3 rounded border border-emerald-900/40">
                              <h4 className="font-semibold text-emerald-300 text-xs">
                                Probabilistic System Verdict
                              </h4>
                              <p className="text-[11px] text-slate-300 leading-relaxed">
                                {stock.aiConclusion}
                              </p>
                              <div className="pt-2">
                                <button
                                  onClick={() => onSelectStock(stock.ticker)}
                                  className="w-full py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded font-semibold text-xs transition flex items-center justify-center gap-1"
                                >
                                  <span>Open Comprehensive Analysis</span>
                                  <ArrowUpRight className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Strategic Rule Enforcement Card */}
      <div className="bg-[#101B2D] border border-[#22304A] rounded-md p-3 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-slate-200">Execution Mandate: </span>
            <span className="text-slate-400">
              Strategy executes in the 15:45 WIB pre-close call auction and sells into opening liquidity between 09:00 - 09:15 WIB. If open is negative and cut-loss is triggered, exit immediately. Never average down an overnight gap failure.
            </span>
          </div>
        </div>
      </div>

      {/* Unified Quant + ML Final Decision Modal */}
      <FinalDecisionModal
        stock={decisionModalStock}
        isOpen={decisionModalStock !== null}
        onClose={() => setDecisionModalStock(null)}
        onAddToJournal={onAddToJournal}
      />

    </div>
  );
};
