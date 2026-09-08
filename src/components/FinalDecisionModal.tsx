// ============================================================================
// FINAL DECISION PANEL COMPONENT (QUANT + ML UNIFIED VERDICT)
// ============================================================================
import React from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Cpu, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  Scale, 
  Sparkles,
  ArrowUpRight,
  DollarSign,
  Layers,
  ChevronRight
} from 'lucide-react';
import { StockData } from '../types';
import { QuantMLEnsembleEngine } from '../engine/ml/ensembleRouter';
import { OvernightMLModel, GapRiskMLModel } from '../engine/ml/models';

interface FinalDecisionModalProps {
  stock: StockData | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToJournal?: (stock: StockData) => void;
}

export const FinalDecisionModal: React.FC<FinalDecisionModalProps> = ({
  stock,
  isOpen,
  onClose,
  onAddToJournal
}) => {
  if (!isOpen || !stock) return null;

  const ensemble = QuantMLEnsembleEngine.evaluate(stock);
  const overnightML = OvernightMLModel.predict(stock);
  const gapRisk = GapRiskMLModel.predict(stock);

  const getDecisionBadge = (decision: string) => {
    switch (decision) {
      case 'QUALIFIED':
        return 'bg-emerald-950 text-emerald-300 border-emerald-500/50 shadow-emerald-950/50';
      case 'CAUTION':
        return 'bg-amber-950 text-amber-300 border-amber-500/50 shadow-amber-950/50';
      case 'CONFLICTING SIGNALS':
        return 'bg-purple-950 text-purple-300 border-purple-500/50 shadow-purple-950/50';
      case 'HIGH RISK':
        return 'bg-rose-950 text-rose-300 border-rose-500/50 shadow-rose-950/50';
      case 'NO TRADE':
        return 'bg-slate-900 text-slate-300 border-slate-700 shadow-slate-900/50';
      default:
        return 'bg-slate-800 text-slate-200 border-slate-700';
    }
  };

  const getConfidenceBadge = (conf: string) => {
    switch (conf) {
      case 'VERY HIGH':
        return 'bg-emerald-900/40 text-emerald-300 border-emerald-500/40';
      case 'HIGH':
        return 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30';
      case 'MODERATE':
        return 'bg-cyan-950/40 text-cyan-300 border-cyan-500/30';
      case 'LOW':
        return 'bg-amber-950/40 text-amber-300 border-amber-500/30';
      default:
        return 'bg-rose-950/40 text-rose-300 border-rose-500/30';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-4xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header Bar */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center font-mono font-black text-emerald-400">
              {stock.ticker}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100">{stock.name}</h2>
                <span className="text-xs font-mono text-slate-400">({stock.sector})</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  ML MODE: SIMULATED
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Rp {stock.price.toLocaleString('id-ID')} • {stock.changePct >= 0 ? '+' : ''}{stock.changePct}% • Vol: {(stock.volume / 1_000_000).toFixed(1)}M
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[82vh] overflow-y-auto">
          
          {/* Top Verdict Strip */}
          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">System Verdict</div>
              <div className="flex items-center gap-2 mt-1">
                <span className={`px-3 py-1 rounded-md text-sm font-black tracking-wide border shadow-sm ${getDecisionBadge(ensemble.systemDecision)}`}>
                  {ensemble.systemDecision}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  Final Quant + ML Edge: <strong className="text-emerald-400 text-sm">{ensemble.finalQuantMLEdge}/100</strong>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs font-mono">
              <div className="px-3 py-1.5 rounded bg-slate-900 border border-slate-800 text-right">
                <div className="text-[10px] text-slate-400">MODEL CONFIDENCE</div>
                <div className={`font-bold mt-0.5 px-1.5 py-0.5 rounded border inline-block text-[11px] ${getConfidenceBadge(ensemble.confidence)}`}>
                  {ensemble.confidence}
                </div>
              </div>

              <div className="px-3 py-1.5 rounded bg-slate-900 border border-slate-800 text-right">
                <div className="text-[10px] text-slate-400">POSITION SIZE</div>
                <div className="font-bold text-emerald-400 mt-0.5 text-sm">
                  {ensemble.recommendedPositionSizePct > 0 ? `${ensemble.recommendedPositionSizePct}% Portfolio` : '0% (Skip)'}
                </div>
              </div>

              <div className="px-3 py-1.5 rounded bg-slate-900 border border-slate-800 text-right">
                <div className="text-[10px] text-slate-400">TAIL RISK</div>
                <div className={`font-bold mt-0.5 text-sm ${ensemble.tailRiskLevel === 'LOW' ? 'text-emerald-400' : ensemble.tailRiskLevel === 'MODERATE' ? 'text-cyan-400' : 'text-rose-400'}`}>
                  {ensemble.tailRiskLevel}
                </div>
              </div>
            </div>
          </div>

          {/* Quant vs ML Multi-Metric Scoreboard */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 font-mono text-xs">
            <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800">
              <div className="text-[10px] text-slate-400 font-sans">QUANT SCORE</div>
              <div className="text-base font-bold text-emerald-400 mt-0.5">{ensemble.quantRuleScore}/100</div>
              <div className="text-[9px] text-slate-500 mt-1">Rule Filters</div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800">
              <div className="text-[10px] text-slate-400 font-sans">ML NET PROB</div>
              <div className="text-base font-bold text-cyan-400 mt-0.5">{ensemble.mlProbability}%</div>
              <div className="text-[9px] text-slate-500 mt-1">After 0.40% Cost</div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800">
              <div className="text-[10px] text-slate-400 font-sans">STAT EDGE</div>
              <div className="text-base font-bold text-slate-200 mt-0.5">{ensemble.statisticalEdgeScore}/100</div>
              <div className="text-[9px] text-slate-500 mt-1">Sample Persistence</div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800">
              <div className="text-[10px] text-slate-400 font-sans">ANALOG MATCH</div>
              <div className="text-base font-bold text-slate-200 mt-0.5">{ensemble.historicalAnalogScore}/100</div>
              <div className="text-[9px] text-slate-500 mt-1">Pattern History</div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800">
              <div className="text-[10px] text-slate-400 font-sans">REGIME FIT</div>
              <div className="text-base font-bold text-emerald-400 mt-0.5">{ensemble.regimeFitScore}/100</div>
              <div className="text-[9px] text-slate-500 mt-1">Macro Tailwind</div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800">
              <div className="text-[10px] text-slate-400 font-sans">GAP RISK</div>
              <div className={`text-base font-bold mt-0.5 ${gapRisk.gapRiskScore < 40 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {gapRisk.gapRiskScore}/100
              </div>
              <div className="text-[9px] text-slate-500 mt-1">Downside Tail</div>
            </div>
          </div>

          {/* Model Consensus & Agreement Status */}
          <div className={`p-4 rounded-lg border text-xs ${
            ensemble.agreementStatus === 'AGREEMENT'
              ? 'bg-emerald-950/30 border-emerald-500/30 text-slate-200'
              : 'bg-purple-950/30 border-purple-500/30 text-slate-200'
          }`}>
            <div className="flex items-center gap-2 font-bold font-mono">
              {ensemble.agreementStatus === 'AGREEMENT' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-purple-400" />
              )}
              <span className={ensemble.agreementStatus === 'AGREEMENT' ? 'text-emerald-300' : 'text-purple-300'}>
                {ensemble.agreementStatus}
              </span>
            </div>
            <p className="mt-1 text-slate-300 leading-relaxed font-sans">
              {ensemble.agreementDetails}
            </p>
          </div>

          {/* Explainable AI (Simulated SHAP Feature Contributions) */}
          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
                  Explainable ML • Feature Contributions (SHAP Values)
                </h4>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                Baseline: 52.0% → Final: {overnightML.probNetPositiveOpen}%
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              {/* Positive Drivers */}
              <div className="space-y-2">
                <div className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
                  <span>TOP POSITIVE FEATURES (ELEVATE EDGE)</span>
                </div>
                {overnightML.explanation.topPositiveFeatures.map((feat, idx) => (
                  <div key={idx} className="p-2 rounded bg-slate-900/90 border border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="text-slate-200 font-medium">{feat.featureName}</div>
                      <div className="text-[10px] text-slate-400 font-sans">{feat.description}</div>
                    </div>
                    <span className="text-emerald-400 font-bold ml-2 whitespace-nowrap">
                      +{feat.contributionPct} pp
                    </span>
                  </div>
                ))}
              </div>

              {/* Negative Drivers */}
              <div className="space-y-2">
                <div className="text-[10px] font-semibold text-rose-400 flex items-center gap-1">
                  <span>TOP NEGATIVE FEATURES (DOWNSIDE DRAG)</span>
                </div>
                {overnightML.explanation.topNegativeFeatures.map((feat, idx) => (
                  <div key={idx} className="p-2 rounded bg-slate-900/90 border border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="text-slate-200 font-medium">{feat.featureName}</div>
                      <div className="text-[10px] text-slate-400 font-sans">{feat.description}</div>
                    </div>
                    <span className="text-rose-400 font-bold ml-2 whitespace-nowrap">
                      {feat.contributionPct} pp
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Systematic Execution Framework (Why & Risks) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Why Qualified */}
            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
              <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider font-mono flex items-center gap-1.5 mb-2">
                <CheckCircle2 className="w-3.5 h-3.5" />
                SYSTEM RATIONALE ("WHY")
              </h4>
              <ul className="space-y-1.5 text-xs text-slate-300 font-sans">
                {ensemble.decisionRationale.map((point, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">•</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Risks to Monitor */}
            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
              <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider font-mono flex items-center gap-1.5 mb-2">
                <AlertTriangle className="w-3.5 h-3.5" />
                RISK FACTORS & AUDIT
              </h4>
              <ul className="space-y-1.5 text-xs text-slate-300 font-sans">
                {ensemble.keyRisks.map((risk, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold">•</span>
                    <span>{risk}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Execution Timing & Rules */}
          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 flex flex-col sm:flex-row gap-4 text-xs font-mono">
            <div className="flex-1">
              <div className="text-[10px] text-slate-400 uppercase">ENTRY PROTOCOL</div>
              <div className="text-slate-200 font-semibold mt-1">{ensemble.entryTrigger}</div>
            </div>
            <div className="flex-1 border-t sm:border-t-0 sm:border-l border-slate-800 pt-3 sm:pt-0 sm:pl-4">
              <div className="text-[10px] text-slate-400 uppercase">EXIT PROTOCOL</div>
              <div className="text-slate-200 font-semibold mt-1">{ensemble.exitRule}</div>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <div className="text-[11px] font-mono text-slate-400">
            Primary Strategy: <strong className="text-slate-200">Overnight Edge (BSJP)</strong> • Model: {overnightML.modelVersion}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
            >
              Close
            </button>
            {onAddToJournal && ensemble.systemDecision !== 'NO TRADE' && (
              <button
                onClick={() => {
                  onAddToJournal(stock);
                  onClose();
                }}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold font-mono transition flex items-center gap-1.5 shadow-lg shadow-emerald-950/40"
              >
                <span>Add Position to Morning Exit Journal</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
