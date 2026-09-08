// ============================================================================
// ML LAB VIEW — ADAPTIVE QUANT & MACHINE LEARNING RESEARCH TERMINAL
// ============================================================================
import React, { useState } from 'react';
import { 
  Cpu, 
  Layers, 
  Activity, 
  TrendingUp, 
  Scale, 
  AlertTriangle, 
  CheckCircle2, 
  Sparkles, 
  ShieldCheck, 
  ShieldAlert,
  RefreshCw, 
  BarChart3, 
  Sliders, 
  HelpCircle, 
  Search, 
  ArrowRight,
  Database,
  History,
  Check,
  ChevronRight
} from 'lucide-react';
import { StockData } from '../types';
import { FeatureStore } from '../engine/ml/featureStore';
import { 
  OvernightMLModel, 
  GapRiskMLModel, 
  IntradayMLModel, 
  SwingMLModel, 
  TrendPersistenceMLModel, 
  BreakoutFailureMLModel, 
  EmergingLeaderMLModel 
} from '../engine/ml/models';
import { 
  MLMetaStrategyRouter, 
  QuantMLEnsembleEngine, 
  PortfolioMLRiskEngine 
} from '../engine/ml/ensembleRouter';
import { 
  CHAMPION_OVERNIGHT_MODEL, 
  CHALLENGER_OVERNIGHT_MODEL, 
  getChampionChallengerComparison, 
  WALK_FORWARD_RECORDS, 
  ACTIVE_DRIFT_METRICS, 
  RETRAINING_HISTORY, 
  INITIAL_ACTUAL_TRADE_RESIDUALS,
  ActualTradeResidual
} from '../engine/ml/modelRegistry';
import { FinalDecisionModal } from './FinalDecisionModal';

interface MLLabViewProps {
  universe: StockData[];
  onSelectStock: (ticker: string) => void;
  onAddToJournal: (stock: StockData) => void;
}

export const MLLabView: React.FC<MLLabViewProps> = ({
  universe,
  onSelectStock,
  onAddToJournal
}) => {
  const [subTab, setSubTab] = useState<
    'OVERVIEW' | 'CALIBRATION' | 'EXPLAINABILITY' | 'WALK_FORWARD' | 'CHAMPION_CHALLENGER' | 'DRIFT' | 'RETRAINING' | 'PORTFOLIO_RISK'
  >('OVERVIEW');

  const [selectedTicker, setSelectedTicker] = useState<string>('BBCA');
  const [decisionModalStock, setDecisionModalStock] = useState<StockData | null>(null);
  const [isEvaluatingRetrain, setIsEvaluatingRetrain] = useState<boolean>(false);
  const [retrainSuccessMsg, setRetrainSuccessMsg] = useState<string | null>(null);
  const [championComparison, setChampionComparison] = useState(getChampionChallengerComparison());
  const [tradeResiduals, setTradeResiduals] = useState<ActualTradeResidual[]>(INITIAL_ACTUAL_TRADE_RESIDUALS);

  const currentStock = universe.find(s => s.ticker === selectedTicker) || universe[0];
  const overnightML = OvernightMLModel.predict(currentStock);
  const gapRiskML = GapRiskMLModel.predict(currentStock);
  const intradayML = IntradayMLModel.predict(currentStock);
  const swingML = SwingMLModel.predict(currentStock);
  const trendML = TrendPersistenceMLModel.predict(currentStock);
  const breakoutML = BreakoutFailureMLModel.predict(currentStock);
  const leaderML = EmergingLeaderMLModel.predict(currentStock);
  const ensemble = QuantMLEnsembleEngine.evaluate(currentStock);
  const strategyRouter = MLMetaStrategyRouter.evaluate(currentStock);
  const leakageAudit = FeatureStore.verifyNoDataLeakage();
  const portfolioRisk = PortfolioMLRiskEngine.evaluate(universe.slice(0, 10));

  const handleRunRetraining = () => {
    setIsEvaluatingRetrain(true);
    setTimeout(() => {
      setIsEvaluatingRetrain(false);
      setRetrainSuccessMsg('Walk-forward evaluation complete! Challenger LightGBM-v4 passed out-of-sample criteria.');
      setTimeout(() => setRetrainSuccessMsg(null), 5000);
    }, 1800);
  };

  const handlePromoteChallenger = () => {
    setChampionComparison(prev => ({
      ...prev,
      recommendation: 'KEEP CHAMPION',
      champion: {
        ...prev.challenger,
        status: 'CHAMPION'
      },
      recommendationRationale: [
        'Promoted Challenger (LightGBM-v4) to Champion status.',
        'Production models updated with tighter calibration and superior expected value.'
      ]
    }));
  };

  return (
    <div className="w-full space-y-4 text-slate-100">
      
      {/* Top Banner: Simulated ML Notice & Architecture Overview */}
      <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border border-cyan-500/40 flex items-center justify-center font-black text-cyan-400">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-100 tracking-wide">
                ML LAB & ADAPTIVE QUANT ENGINE
              </h1>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                ML MODE: SIMULATED
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                DATA: MOCK IDX
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Probabilistic machine learning models layered onto quantitative rules. Estimates conditional probabilities P(Win|X), tail risk, calibration, and drift.
            </p>
          </div>
        </div>

        {/* Global Leakage Check Pill */}
        <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-mono">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="text-slate-400">DATA LEAKAGE AUDIT:</span>
          <span className="font-bold text-emerald-400">{leakageAudit.status}</span>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-800 overflow-x-auto pb-1 text-xs font-mono">
        {[
          { id: 'OVERVIEW', label: '1. PREDICTIONS & MULTI-MODEL' },
          { id: 'CALIBRATION', label: '2. MODEL CALIBRATION' },
          { id: 'EXPLAINABILITY', label: '3. SHAP EXPLAINABILITY' },
          { id: 'WALK_FORWARD', label: '4. WALK-FORWARD & LEAKAGE' },
          { id: 'CHAMPION_CHALLENGER', label: '5. CHAMPION VS CHALLENGER' },
          { id: 'DRIFT', label: '6. MODEL DRIFT & HEALTH' },
          { id: 'RETRAINING', label: '7. RETRAINING & JOURNAL LEARNING' },
          { id: 'PORTFOLIO_RISK', label: '8. PORTFOLIO ML RISK' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id as any)}
            className={`px-3.5 py-2 rounded-t-lg transition whitespace-nowrap font-semibold flex items-center gap-1.5 border-t border-x ${
              subTab === tab.id
                ? 'bg-slate-900 text-cyan-300 border-slate-700 border-b-transparent shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 border-transparent'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: PREDICTIONS & MULTI-MODEL SCORECARD */}
      {/* ==================================================================== */}
      {subTab === 'OVERVIEW' && (
        <div className="space-y-6">
          {/* Ticker Selector Bar */}
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-mono">ANALYZING TICKER:</span>
              <div className="flex items-center gap-1 overflow-x-auto">
                {universe.slice(0, 8).map(st => (
                  <button
                    key={st.ticker}
                    onClick={() => setSelectedTicker(st.ticker)}
                    className={`px-2.5 py-1 rounded font-mono font-bold transition ${
                      selectedTicker === st.ticker
                        ? 'bg-emerald-600 text-white shadow'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {st.ticker}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setDecisionModalStock(currentStock)}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold transition flex items-center gap-1.5 shadow"
            >
              <span>View Full Unified Decision Panel</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Unified Ensemble Banner */}
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black font-mono text-slate-100">{currentStock.ticker}</h3>
                <span className="text-xs text-slate-400">({currentStock.name})</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                  Rp {currentStock.price.toLocaleString('id-ID')}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                Consensus: <strong className={ensemble.agreementStatus === 'AGREEMENT' ? 'text-emerald-400' : 'text-purple-400'}>{ensemble.agreementStatus}</strong> • Primary Strategy: <strong>Overnight Edge (BSJP)</strong>
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-right">
                <div className="text-[10px] text-slate-400">QUANT SCORE</div>
                <div className="text-base font-bold text-emerald-400">{ensemble.quantRuleScore}/100</div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-right">
                <div className="text-[10px] text-slate-400">ML PROBABILITY</div>
                <div className="text-base font-bold text-cyan-400">{ensemble.mlProbability}%</div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-right">
                <div className="text-[10px] text-slate-400">FINAL EDGE</div>
                <div className="text-base font-bold text-emerald-300">{ensemble.finalQuantMLEdge}/100</div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-right">
                <div className="text-[10px] text-slate-400">DECISION</div>
                <div className={`text-base font-bold ${ensemble.systemDecision === 'QUALIFIED' ? 'text-emerald-400' : ensemble.systemDecision === 'HIGH RISK' ? 'text-rose-400' : 'text-amber-400'}`}>
                  {ensemble.systemDecision}
                </div>
              </div>
            </div>
          </div>

          {/* Grid of 7 Specialized ML Models */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            
            {/* 1. Overnight BSJP Model */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-1.5 font-bold font-mono text-xs text-slate-200">
                  <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                  <span>OVERNIGHT BSJP MODEL</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">XGBoost v3.2</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-slate-400">P(Net Open &gt; Entry + Cost)</span>
                <span className="text-xl font-bold font-mono text-emerald-400">{overnightML.probNetPositiveOpen}%</span>
              </div>
              <div className="space-y-1 text-[11px] font-mono text-slate-400 border-t border-slate-800/80 pt-2">
                <div className="flex justify-between">
                  <span>Gross Green Open:</span>
                  <span className="text-slate-200">{overnightML.probGreenOpen}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Expected Net Return:</span>
                  <span className="text-emerald-400">+{overnightML.expectedOvernightReturnNet}%</span>
                </div>
                <div className="flex justify-between">
                  <span>P(Gap &lt; -1%):</span>
                  <span className={overnightML.probGapBelowOnePct > 15 ? 'text-rose-400' : 'text-slate-300'}>
                    {overnightML.probGapBelowOnePct}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Confidence:</span>
                  <span className="text-cyan-300 font-bold">{overnightML.confidence}</span>
                </div>
              </div>
            </div>

            {/* 2. Gap Risk Model */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-1.5 font-bold font-mono text-xs text-slate-200">
                  <div className="w-2 h-2 rounded-full bg-rose-400"></div>
                  <span>GAP RISK INDEPENDENT MODEL</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">LightGBM v2.4</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-slate-400">Gap Risk Score (0-100)</span>
                <span className={`text-xl font-bold font-mono ${gapRiskML.gapRiskScore < 40 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {gapRiskML.gapRiskScore}/100
                </span>
              </div>
              <div className="space-y-1 text-[11px] font-mono text-slate-400 border-t border-slate-800/80 pt-2">
                <div className="flex justify-between">
                  <span>Risk Level:</span>
                  <span className={`font-bold ${gapRiskML.riskLevel === 'LOW' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {gapRiskML.riskLevel}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>P(Gap &lt; -0.5%):</span>
                  <span className="text-slate-200">{gapRiskML.probGapBelowHalfPct}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Expected Shortfall (CVaR):</span>
                  <span className="text-rose-400">{gapRiskML.expectedShortfallCVaR}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Tail Probability:</span>
                  <span className="text-slate-300">{gapRiskML.tailProbability}%</span>
                </div>
              </div>
            </div>

            {/* 3. Intraday BPJS Model */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-1.5 font-bold font-mono text-xs text-slate-200">
                  <div className="w-2 h-2 rounded-full bg-cyan-400"></div>
                  <span>INTRADAY MORNING BPJS</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">RandomForest v2.1</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-slate-400">P(Intraday Positive)</span>
                <span className="text-xl font-bold font-mono text-cyan-400">{intradayML.probPositiveIntraday}%</span>
              </div>
              <div className="space-y-1 text-[11px] font-mono text-slate-400 border-t border-slate-800/80 pt-2">
                <div className="flex justify-between">
                  <span>Classification:</span>
                  <span className="text-slate-200 font-bold">{intradayML.classification}</span>
                </div>
                <div className="flex justify-between">
                  <span>Expected Return:</span>
                  <span className="text-emerald-400">+{intradayML.expectedIntradayReturn}%</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1 truncate">
                  Setup: {intradayML.recommendedSetup}
                </div>
              </div>
            </div>

            {/* 4. Swing Model (Multi-Horizon) */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-1.5 font-bold font-mono text-xs text-slate-200">
                  <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                  <span>SWING HORIZON MODEL</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">GBM v4.0</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-slate-400">5-Day Positive Prob</span>
                <span className="text-xl font-bold font-mono text-amber-400">{swingML.horizons['5D'].probPositiveReturn}%</span>
              </div>
              <div className="grid grid-cols-4 gap-1 text-center font-mono text-[10px] border-t border-slate-800/80 pt-2">
                <div className="p-1 rounded bg-slate-950 border border-slate-800">
                  <div className="text-slate-400">3D</div>
                  <div className="font-bold text-slate-200 mt-0.5">{swingML.horizons['3D'].probPositiveReturn}%</div>
                </div>
                <div className="p-1 rounded bg-slate-950 border border-slate-800">
                  <div className="text-slate-400">5D</div>
                  <div className="font-bold text-amber-400 mt-0.5">{swingML.horizons['5D'].probPositiveReturn}%</div>
                </div>
                <div className="p-1 rounded bg-slate-950 border border-slate-800">
                  <div className="text-slate-400">10D</div>
                  <div className="font-bold text-slate-200 mt-0.5">{swingML.horizons['10D'].probPositiveReturn}%</div>
                </div>
                <div className="p-1 rounded bg-slate-950 border border-slate-800">
                  <div className="text-slate-400">20D</div>
                  <div className="font-bold text-slate-200 mt-0.5">{swingML.horizons['20D'].probPositiveReturn}%</div>
                </div>
              </div>
              <div className="text-[11px] font-mono text-slate-400 flex justify-between">
                <span>Action:</span>
                <span className="text-emerald-400 font-bold">{swingML.recommendation}</span>
              </div>
            </div>

            {/* 5. Trend Persistence Model */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-1.5 font-bold font-mono text-xs text-slate-200">
                  <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                  <span>TREND PERSISTENCE MODEL</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">XGBoost v1.3</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-slate-400">Trend Persistence Prob</span>
                <span className="text-xl font-bold font-mono text-blue-400">{trendML.trendPersistenceProb}%</span>
              </div>
              <div className="space-y-1 text-[11px] font-mono text-slate-400 border-t border-slate-800/80 pt-2">
                <div className="flex justify-between">
                  <span>Trend Quality:</span>
                  <span className="text-slate-200">{trendML.trendQuality}/100</span>
                </div>
                <div className="flex justify-between">
                  <span>Expected Duration:</span>
                  <span className="text-slate-200">{trendML.expectedTrendDurationDays} bars</span>
                </div>
                <div className="flex justify-between">
                  <span>Overextension Risk:</span>
                  <span className={trendML.overextensionRisk === 'LOW' ? 'text-emerald-400' : 'text-amber-400'}>
                    {trendML.overextensionRisk}
                  </span>
                </div>
              </div>
            </div>

            {/* 6. Breakout Failure Model */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-1.5 font-bold font-mono text-xs text-slate-200">
                  <div className="w-2 h-2 rounded-full bg-purple-400"></div>
                  <span>BREAKOUT FAILURE MODEL</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">CatBoost v2.0</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-slate-400">Breakout Success Prob</span>
                <span className="text-xl font-bold font-mono text-purple-400">{breakoutML.breakoutSuccessProb}%</span>
              </div>
              <div className="space-y-1 text-[11px] font-mono text-slate-400 border-t border-slate-800/80 pt-2">
                <div className="flex justify-between">
                  <span>False Breakout Trap Risk:</span>
                  <span className={breakoutML.falseBreakoutProb > 30 ? 'text-rose-400' : 'text-slate-300'}>
                    {breakoutML.falseBreakoutProb}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Volume Confirmed:</span>
                  <span className={breakoutML.isVolumeConfirmed ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                    {breakoutML.isVolumeConfirmed ? 'YES (>1.5x)' : 'NO'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Expected Follow-Through:</span>
                  <span className="text-slate-200">+{breakoutML.expectedFollowThroughPct}%</span>
                </div>
              </div>
            </div>

            {/* 7. Emerging Leader Model (Hidden Gem) */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 col-span-1 md:col-span-2 lg:col-span-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-1.5 font-bold font-mono text-xs text-slate-200">
                  <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                  <span>EMERGING LEADER ML RESEARCH (LONG-HORIZON FUNDAMENTAL + TECHNICAL INFLECTION)</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">LightGBM v1.1 • Long-Horizon</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3 font-mono text-xs">
                <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                  <div className="text-[10px] text-slate-400">CLASSIFICATION</div>
                  <div className="text-sm font-bold text-emerald-400 mt-1">{leaderML.classification}</div>
                </div>
                <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                  <div className="text-[10px] text-slate-400">LEADER PROBABILITY</div>
                  <div className="text-sm font-bold text-cyan-400 mt-1">{leaderML.emergingLeaderProb}%</div>
                </div>
                <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                  <div className="text-[10px] text-slate-400">INFLECTION SCORE</div>
                  <div className="text-sm font-bold text-slate-200 mt-1">{leaderML.fundamentalInflectionScore}/100</div>
                </div>
                <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                  <div className="text-[10px] text-slate-400">QUALITY SCORE</div>
                  <div className="text-sm font-bold text-slate-200 mt-1">{leaderML.qualityScore}/100</div>
                </div>
                <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                  <div className="text-[10px] text-slate-400">GROWTH SCORE</div>
                  <div className="text-sm font-bold text-slate-200 mt-1">{leaderML.growthScore}/100</div>
                </div>
                <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                  <div className="text-[10px] text-slate-400">MARKET CONFIRMATION</div>
                  <div className="text-sm font-bold text-emerald-400 mt-1">{leaderML.marketConfirmationScore}/100</div>
                </div>
              </div>
              <div className="text-xs text-slate-400 font-mono">
                <strong>Inflection Drivers:</strong> {leaderML.inflectionDrivers.join(' • ')}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: MODEL CALIBRATION & RELIABILITY LAB */}
      {/* ==================================================================== */}
      {subTab === 'CALIBRATION' && (
        <div className="space-y-6">
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-200 font-mono flex items-center gap-2">
                  <Scale className="w-4 h-4 text-cyan-400" />
                  MODEL CALIBRATION & PROBABILITY RELIABILITY LAB
                </h3>
                <p className="text-xs text-slate-400 mt-1 font-sans">
                  Evaluates probability calibration. If the model predicts 70% probability, approximately 70% of empirical historical events must occur.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded bg-emerald-950 border border-emerald-500/40 text-emerald-300 font-mono text-xs">
                  Calibration: WELL CALIBRATED
                </span>
                <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 font-mono text-xs">
                  Brier Score: {CHAMPION_OVERNIGHT_MODEL.metrics.brierScore}
                </span>
              </div>
            </div>

            {/* Calibration Table */}
            <div className="overflow-x-auto border border-slate-800 rounded-lg">
              <table className="w-full text-xs font-mono text-left">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-3">Predicted Probability Bucket</th>
                    <th className="p-3 text-right">Predicted Midpoint</th>
                    <th className="p-3 text-right">Actual Observed Win Rate</th>
                    <th className="p-3 text-right">Calibration Error</th>
                    <th className="p-3 text-right">Sample Size</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {CHAMPION_OVERNIGHT_MODEL.calibrationBuckets.map((b, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40">
                      <td className="p-3 font-semibold text-slate-200">{b.rangeLabel}</td>
                      <td className="p-3 text-right text-slate-400">{b.predictedMid}%</td>
                      <td className="p-3 text-right font-bold text-slate-200">{b.observedWinRate}%</td>
                      <td className={`p-3 text-right font-bold ${Math.abs(b.error) <= 1.0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {b.error >= 0 ? `+${b.error}%` : `${b.error}%`}
                      </td>
                      <td className="p-3 text-right text-slate-400">{b.sampleCount} trades</td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                          CALIBRATED
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Calibration Philosophy Callout */}
            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-xs font-sans text-slate-300 space-y-2">
              <div className="font-bold text-amber-400 font-mono flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                CALIBRATION OVER RAW ACCURACY RULE
              </div>
              <p className="leading-relaxed">
                Financial prediction models with 85%+ reported classification accuracy on time-series data almost universally suffer from lookahead bias, regime overfit, or probability distortion. Our engine enforces expected calibration error (ECE &lt; 3.5%) and penalizes uncalibrated overconfidence before any model can enter production.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: SHAP EXPLAINABILITY */}
      {/* ==================================================================== */}
      {subTab === 'EXPLAINABILITY' && (
        <div className="space-y-6">
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-200 font-mono flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  EXPLAINABLE MACHINE LEARNING (SIMULATED SHAP FEATURE CONTRIBUTIONS)
                </h3>
                <p className="text-xs text-slate-400 mt-1 font-sans">
                  Never accept black-box outputs. Each probability is decomposed into explicit positive and negative percentage point contributions from the baseline prior.
                </p>
              </div>

              <div className="text-xs font-mono text-slate-400 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                Selected Stock: <strong className="text-emerald-400">{currentStock.ticker}</strong>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Positive Contributors */}
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-emerald-400 font-mono uppercase flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  TOP POSITIVE DRIVERS (EDGE BOOST)
                </h4>
                <div className="space-y-2">
                  {overnightML.explanation.topPositiveFeatures.map((feat, idx) => (
                    <div key={idx} className="p-2.5 rounded bg-slate-900 border border-slate-800 flex items-center justify-between text-xs font-mono">
                      <div>
                        <div className="text-slate-200 font-bold">{feat.featureName}</div>
                        <div className="text-[11px] text-slate-400 font-sans">{feat.description}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Value: {feat.value} • Category: {feat.featureCategory}</div>
                      </div>
                      <span className="text-emerald-400 font-black text-sm ml-2">
                        +{feat.contributionPct} pp
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Negative Contributors */}
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-rose-400 font-mono uppercase flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  TOP NEGATIVE DRIVERS (DOWNSIDE PENALTY)
                </h4>
                <div className="space-y-2">
                  {overnightML.explanation.topNegativeFeatures.map((feat, idx) => (
                    <div key={idx} className="p-2.5 rounded bg-slate-900 border border-slate-800 flex items-center justify-between text-xs font-mono">
                      <div>
                        <div className="text-slate-200 font-bold">{feat.featureName}</div>
                        <div className="text-[11px] text-slate-400 font-sans">{feat.description}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Value: {feat.value} • Category: {feat.featureCategory}</div>
                      </div>
                      <span className="text-rose-400 font-black text-sm ml-2">
                        {feat.contributionPct} pp
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 4: WALK-FORWARD VALIDATION & DATA LEAKAGE AUDIT */}
      {/* ==================================================================== */}
      {subTab === 'WALK_FORWARD' && (
        <div className="space-y-6">
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-200 font-mono flex items-center gap-2">
                <History className="w-4 h-4 text-cyan-400" />
                CHRONOLOGICAL WALK-FORWARD ML VALIDATION
              </h3>
              <p className="text-xs text-slate-400 mt-1 font-sans">
                Financial time series are never randomly shuffled or k-fold split. Evaluation enforces strict chronological Train (60%), Validation (20%), and Out-of-Sample (20%) rolling test cycles.
              </p>
            </div>

            <div className="overflow-x-auto border border-slate-800 rounded-lg">
              <table className="w-full text-xs font-mono text-left">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-3">Walk-Forward Cycle</th>
                    <th className="p-3">Windows (Train / Val / Test)</th>
                    <th className="p-3 text-right">Train AUC</th>
                    <th className="p-3 text-right">Out-of-Sample Test AUC</th>
                    <th className="p-3 text-right">Test Expectancy</th>
                    <th className="p-3 text-right">Performance Decay</th>
                    <th className="p-3 text-center">Overfit Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {WALK_FORWARD_RECORDS.map((rec) => (
                    <tr key={rec.cycleId} className="hover:bg-slate-800/40">
                      <td className="p-3 font-semibold text-slate-200">{rec.cycleId}</td>
                      <td className="p-3 text-slate-400 text-[11px]">
                        {rec.trainRange} → {rec.testRange}
                      </td>
                      <td className="p-3 text-right text-slate-400">{rec.trainAuc.toFixed(3)}</td>
                      <td className="p-3 text-right font-bold text-emerald-400">{rec.testAuc.toFixed(3)}</td>
                      <td className="p-3 text-right font-bold text-slate-200">+{rec.testExpectancy}%</td>
                      <td className="p-3 text-right text-slate-400">-{rec.performanceDecayPct}%</td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                          {rec.overfitRisk}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Data Leakage Protection Safeguard Section */}
            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-bold text-emerald-400 font-mono text-xs flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  SYSTEM SAFEGUARD: DATA LEAKAGE AUDIT (TIME-T ISOLATION)
                </div>
                <span className="text-[10px] font-mono text-slate-400">Verified: 42 Features</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {leakageAudit.leakageTests.map((t, idx) => (
                  <div key={idx} className="p-2 rounded bg-slate-900 border border-slate-800 text-xs font-mono">
                    <div className="flex items-center gap-1.5 text-slate-200 font-semibold">
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{t.testName}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-sans mt-0.5">{t.details}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 5: CHAMPION VS CHALLENGER */}
      {/* ==================================================================== */}
      {subTab === 'CHAMPION_CHALLENGER' && (
        <div className="space-y-6">
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-200 font-mono flex items-center gap-2">
                  <Scale className="w-4 h-4 text-cyan-400" />
                  CHAMPION VS CHALLENGER MODEL REGISTRY
                </h3>
                <p className="text-xs text-slate-400 mt-1 font-sans">
                  Never automatically promote unvetted models. Production models (Champions) compete against newly trained candidates (Challengers) across strict out-of-sample criteria.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="px-3 py-1 rounded bg-emerald-950 border border-emerald-500/40 text-emerald-300 font-mono text-xs font-bold">
                  RECOMMENDATION: {championComparison.recommendation}
                </span>
                {championComparison.recommendation === 'PROMOTE CHALLENGER' && (
                  <button
                    onClick={handlePromoteChallenger}
                    className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold transition shadow"
                  >
                    Promote Challenger to Champion
                  </button>
                )}
              </div>
            </div>

            {/* Comparison Matrix */}
            <div className="overflow-x-auto border border-slate-800 rounded-lg">
              <table className="w-full text-xs font-mono text-left">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-3">Evaluation Metric</th>
                    <th className="p-3 text-right">Champion ({championComparison.champion.modelName})</th>
                    <th className="p-3 text-right">Challenger ({championComparison.challenger.modelName})</th>
                    <th className="p-3 text-right">Delta</th>
                    <th className="p-3 text-center">Winner</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {championComparison.metricComparisons.map((m, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40">
                      <td className="p-3 font-semibold text-slate-200">{m.metric}</td>
                      <td className="p-3 text-right text-slate-400">{m.championValue}</td>
                      <td className="p-3 text-right font-bold text-slate-200">{m.challengerValue}</td>
                      <td className={`p-3 text-right font-bold ${m.winner === 'CHALLENGER' ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {m.delta >= 0 ? `+${m.delta}` : `${m.delta}`}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          m.winner === 'CHALLENGER' 
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30' 
                            : 'bg-slate-800 text-slate-300'
                        }`}>
                          {m.winner}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Audit Rationale */}
            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2 text-xs font-sans text-slate-300">
              <div className="font-bold text-slate-200 font-mono">PROMOTION CRITERIA AUDIT:</div>
              <ul className="space-y-1">
                {championComparison.recommendationRationale.map((r, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">•</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 6: MODEL DRIFT MONITORING */}
      {/* ==================================================================== */}
      {subTab === 'DRIFT' && (
        <div className="space-y-6">
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-200 font-mono flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                PRODUCTION MODEL DRIFT & HEALTH MONITORING
              </h3>
              <p className="text-xs text-slate-400 mt-1 font-sans">
                Monitors prediction distribution drift (Kolmogorov-Smirnov proxy), feature drift (Population Stability Index - PSI), calibration drift, and win rate deviations.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ACTIVE_DRIFT_METRICS.map(d => (
                <div key={d.modelId} className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3 text-xs font-mono">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-bold text-slate-200">{d.modelName}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      d.overallHealth === 'HEALTHY' 
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40' 
                        : 'bg-amber-950 text-amber-300 border border-amber-500/40'
                    }`}>
                      {d.overallHealth}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-400">Prediction Drift (KS):</span>
                      <span className="ml-1 font-bold text-slate-200">{d.predictionDriftKSScore}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Feature Drift (PSI):</span>
                      <span className="ml-1 font-bold text-slate-200">{d.featureDriftPSIScore}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Recent Win Rate:</span>
                      <span className="ml-1 font-bold text-emerald-400">{d.recentActualWinRate}%</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Expected Win Rate:</span>
                      <span className="ml-1 font-bold text-slate-300">{d.recentExpectedWinRate}%</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Regime Familiarity:</span>
                      <span className="ml-1 font-bold text-cyan-400">{d.regimeFamiliarityPct}%</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Sample Monitored:</span>
                      <span className="ml-1 font-bold text-slate-300">{d.recentSampleSize} trades</span>
                    </div>
                  </div>

                  <div className="p-2 rounded bg-slate-900 border border-slate-800/80 text-[11px] font-sans text-slate-300">
                    <strong>Action:</strong> {d.recommendation}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 7: RETRAINING PIPELINE & JOURNAL RESIDUAL LEARNING */}
      {/* ==================================================================== */}
      {subTab === 'RETRAINING' && (
        <div className="space-y-6">
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-200 font-mono flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-cyan-400" />
                  RETRAINING PIPELINE & JOURNAL RESIDUAL LEARNING
                </h3>
                <p className="text-xs text-slate-400 mt-1 font-sans">
                  Connects actual trading outcomes from the Morning Exit Desk to the model observation database. Evaluates error residuals without recklessly modifying models on individual trades.
                </p>
              </div>

              <button
                onClick={handleRunRetraining}
                disabled={isEvaluatingRetrain}
                className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 text-white font-mono text-xs font-bold transition flex items-center gap-1.5 shadow"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isEvaluatingRetrain ? 'animate-spin' : ''}`} />
                <span>{isEvaluatingRetrain ? 'Running Walk-Forward Simulation...' : 'Run Scheduled Retrain Audit'}</span>
              </button>
            </div>

            {retrainSuccessMsg && (
              <div className="p-3 rounded-lg bg-emerald-950/80 border border-emerald-500 text-emerald-300 text-xs font-mono">
                {retrainSuccessMsg}
              </div>
            )}

            {/* Pipeline Stage Visualization */}
            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-[11px] font-mono text-slate-400 mb-2 uppercase tracking-wider">
                Maturity Workflow: Observation to Model Promotion
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2 text-center text-[10px] font-mono">
                {[
                  '1. NEW TRADE COMPLETED',
                  '2. RESIDUAL LOGGED',
                  '3. SUFFICIENCY CHECK',
                  '4. DRIFT AUDIT',
                  '5. TRAIN CHALLENGER',
                  '6. WALK-FORWARD TEST',
                  '7. CHAMPION COMPARE',
                  '8. PROMOTED'
                ].map((step, idx) => (
                  <div key={idx} className="p-2 rounded bg-slate-900 border border-slate-800 flex flex-col justify-center">
                    <span className="font-bold text-slate-300">{step}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actual Trade Residuals Table */}
            <div>
              <h4 className="text-xs font-bold text-slate-200 font-mono uppercase mb-2">
                Actual Trades vs Model Forecast Residuals (Morning Exit Desk Log)
              </h4>
              <div className="overflow-x-auto border border-slate-800 rounded-lg">
                <table className="w-full text-xs font-mono text-left">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-3">Ticker</th>
                      <th className="p-3">Entry WIB</th>
                      <th className="p-3 text-right">Predicted P(Win)</th>
                      <th className="p-3 text-right">Expected Gap</th>
                      <th className="p-3 text-right">Actual Open Gap</th>
                      <th className="p-3 text-right">Actual Net P/L</th>
                      <th className="p-3 text-right">Residual Error</th>
                      <th className="p-3">Research Post-Mortem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {tradeResiduals.map((res) => (
                      <tr key={res.id} className="hover:bg-slate-800/40">
                        <td className="p-3 font-bold text-slate-200">{res.ticker}</td>
                        <td className="p-3 text-slate-400 text-[11px]">{res.entryDate}</td>
                        <td className="p-3 text-right text-cyan-400 font-semibold">{res.predictedProbability}%</td>
                        <td className="p-3 text-right text-slate-400">+{res.expectedGapPct}%</td>
                        <td className={`p-3 text-right font-bold ${res.actualGapPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {res.actualGapPct >= 0 ? `+${res.actualGapPct}%` : `${res.actualGapPct}%`}
                        </td>
                        <td className={`p-3 text-right font-bold ${res.actualNetReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {res.actualNetReturnPct >= 0 ? `+${res.actualNetReturnPct}%` : `${res.actualNetReturnPct}%`}
                        </td>
                        <td className={`p-3 text-right font-bold ${res.residualError >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {res.residualError >= 0 ? `+${res.residualError.toFixed(2)}%` : `${res.residualError.toFixed(2)}%`}
                        </td>
                        <td className="p-3 text-slate-300 font-sans text-[11px] max-w-xs truncate">
                          {res.researchNotes}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Retraining History Log */}
            <div>
              <h4 className="text-xs font-bold text-slate-200 font-mono uppercase mb-2">
                Model Retraining & Versioning Audit Log
              </h4>
              <div className="space-y-2">
                {RETRAINING_HISTORY.map((rh) => (
                  <div key={rh.id} className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-200">{rh.modelName}</span>
                        <span className="text-slate-500">•</span>
                        <span className="text-slate-400">{rh.previousVersion} → {rh.newCandidateVersion}</span>
                        <span className={`px-2 py-0.2 rounded text-[10px] ${rh.validationOutcome === 'PROMOTED' ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30' : 'bg-cyan-950 text-cyan-300 border border-cyan-500/30'}`}>
                          {rh.validationOutcome}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-sans mt-0.5">{rh.details}</div>
                    </div>
                    <div className="text-right text-[11px] text-slate-500">
                      <div>{rh.timestamp}</div>
                      <div>+{rh.dataPointsAdded} bars added</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 8: PORTFOLIO ML RISK */}
      {/* ==================================================================== */}
      {subTab === 'PORTFOLIO_RISK' && (
        <div className="space-y-6">
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-200 font-mono flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-cyan-400" />
                PORTFOLIO ML RISK & CORRELATION ENGINE
              </h3>
              <p className="text-xs text-slate-400 mt-1 font-sans">
                Evaluates aggregate risk across simultaneous recommendations. Prevents over-concentration in highly correlated industry sectors and mitigates tail risk heat.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 font-mono text-xs">
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">PORTFOLIO HEAT SCORE</div>
                <div className={`text-xl font-bold mt-1 ${portfolioRisk.portfolioHeatScore < 40 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {portfolioRisk.portfolioHeatScore}/100
                </div>
                <div className="text-[10px] text-slate-500 mt-1">Status: {portfolioRisk.portfolioHeatStatus}</div>
              </div>

              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">CORRELATION RISK</div>
                <div className="text-xl font-bold text-slate-200 mt-1">{portfolioRisk.correlationRiskScore}/100</div>
                <div className="text-[10px] text-slate-500 mt-1">Inter-asset beta factor</div>
              </div>

              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">PORTFOLIO CVAR (95%)</div>
                <div className="text-xl font-bold text-rose-400 mt-1">{portfolioRisk.tailRiskAggregateCVaR}%</div>
                <div className="text-[10px] text-slate-500 mt-1">Severe tail loss estimate</div>
              </div>

              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">RECOMMENDATION</div>
                <div className="text-xs font-sans text-slate-300 mt-1 leading-relaxed">
                  {portfolioRisk.recommendation}
                </div>
              </div>
            </div>

            {/* Sector Breakdown */}
            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
              <h4 className="text-xs font-bold text-slate-200 font-mono uppercase">
                Sector Weight Exposure vs Risk Limit
              </h4>
              <div className="space-y-2">
                {portfolioRisk.sectorConcentrations.map(sc => (
                  <div key={sc.sector} className="space-y-1">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-slate-300">{sc.sector}</span>
                      <span className={`font-bold ${sc.weightPct > sc.maxAllowedPct ? 'text-rose-400' : 'text-slate-400'}`}>
                        {sc.weightPct}% (Limit: {sc.maxAllowedPct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full ${sc.weightPct > sc.maxAllowedPct ? 'bg-rose-500' : 'bg-cyan-500'}`}
                        style={{ width: `${Math.min(100, sc.weightPct)}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Final Decision Modal */}
      <FinalDecisionModal
        stock={decisionModalStock}
        isOpen={decisionModalStock !== null}
        onClose={() => setDecisionModalStock(null)}
        onAddToJournal={onAddToJournal}
      />

    </div>
  );
};
