import React, { useState, useMemo } from 'react';
import {
  FlaskConical,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sliders,
  History,
} from 'lucide-react';
import { StockData } from '../types';
import {
  QuantLabConditionDefinition,
  QuantLabConditionalEvaluation,
} from '../engine/researchApplication';
import {
  ConditionalProbabilityResult,
  HistoricalAnalog,
} from '../engine/strategyTypes';
import { StockQuantProfileModal } from './StockQuantProfileModal';

interface QuantLabViewProps {
  universe: StockData[];
  conditionCatalog: QuantLabConditionDefinition[];
  evaluateConditionalProbability: (
    universe: StockData[],
    selectedConditionIds: string[],
  ) => QuantLabConditionalEvaluation;
  runSetupDiscovery: (universe: StockData[]) => ConditionalProbabilityResult[];
  findHistoricalAnalogs: (
    targetStock: StockData,
    universe: StockData[],
    limit: number,
  ) => HistoricalAnalog[];
  onSelectStock: (ticker: string) => void;
  onAddToJournal: (stock: StockData) => void;
}

export const QuantLabView: React.FC<QuantLabViewProps> = ({
  universe,
  conditionCatalog,
  evaluateConditionalProbability,
  runSetupDiscovery,
  findHistoricalAnalogs,
  onSelectStock,
  onAddToJournal,
}) => {
  const [activeTab, setActiveTab] = useState<'CONDITIONAL_PROB' | 'SETUP_DISCOVERY' | 'ANALOGS'>('CONDITIONAL_PROB');

  const [selectedConditionIds, setSelectedConditionIds] = useState<string[]>([
    'cond-macd-cross',
    'cond-price-above-ma50',
    'cond-bandar-acc',
  ]);

  const [targetTicker, setTargetTicker] = useState<string>(universe[0]?.ticker || 'BBCA');
  const [profileStock, setProfileStock] = useState<StockData | null>(null);

  const conditionalEvaluation = useMemo(() => (
    evaluateConditionalProbability(universe, selectedConditionIds)
  ), [evaluateConditionalProbability, universe, selectedConditionIds]);
  const conditionalResult = conditionalEvaluation.result;

  const discoveredSetups = useMemo(() => (
    runSetupDiscovery(universe)
  ), [runSetupDiscovery, universe]);

  const targetStock = useMemo(() => (
    universe.find(s => s.ticker === targetTicker) || universe[0]
  ), [universe, targetTicker]);

  const analogs = useMemo(() => {
    if (!targetStock) return [];
    return findHistoricalAnalogs(targetStock, universe, 6);
  }, [findHistoricalAnalogs, targetStock, universe]);

  const toggleCondition = (id: string) => {
    setSelectedConditionIds(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const clearConditions = () => {
    setSelectedConditionIds([]);
  };

  return (
    <div className="w-full space-y-4 text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <FlaskConical className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Quantitative Research Lab</h1>
            <p className="text-xs text-slate-400">
              Conditional probability modeling, algorithmic setup discovery, and historical analog pattern matching.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-lg text-xs font-mono">
          <button
            onClick={() => setActiveTab('CONDITIONAL_PROB')}
            className={`px-3 py-1.5 rounded-md font-semibold transition ${
              activeTab === 'CONDITIONAL_PROB' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Conditional Probability Engine
          </button>
          <button
            onClick={() => setActiveTab('SETUP_DISCOVERY')}
            className={`px-3 py-1.5 rounded-md font-semibold transition ${
              activeTab === 'SETUP_DISCOVERY' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Setup Discovery
          </button>
          <button
            onClick={() => setActiveTab('ANALOGS')}
            className={`px-3 py-1.5 rounded-md font-semibold transition ${
              activeTab === 'ANALOGS' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Historical Setup Analogs
          </button>
        </div>
      </div>

      {activeTab === 'CONDITIONAL_PROB' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-mono font-bold text-slate-300 uppercase">
                  Select Conditions ({selectedConditionIds.length})
                </span>
                <button
                  onClick={clearConditions}
                  className="text-[11px] font-mono text-slate-400 hover:text-slate-200 flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </button>
              </div>

              <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
                {conditionCatalog.map(cond => {
                  const isChecked = selectedConditionIds.includes(cond.id);
                  return (
                    <button
                      key={cond.id}
                      onClick={() => toggleCondition(cond.id)}
                      className={`w-full text-left p-3 rounded-lg border text-xs transition ${
                        isChecked
                          ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-200'
                          : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-200">{cond.name}</span>
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                          isChecked ? 'bg-emerald-900 text-emerald-300' : 'bg-slate-800 text-slate-500'
                        }`}>
                          {cond.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">{cond.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-2 space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
                <div className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Conditional Edge Calculation</span>
                  <span className="text-emerald-400 font-bold">
                    Confidence: {conditionalResult.confidenceScore}/100
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-center">
                    <div className="text-[10px] text-slate-400">P(Win | Conditions)</div>
                    <div className="text-2xl font-bold text-emerald-400 mt-0.5">
                      {conditionalResult.conditionalWinRate}%
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      vs {conditionalResult.baselineWinRate}% baseline
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-center">
                    <div className="text-[10px] text-slate-400">Statistical Edge</div>
                    <div className="text-2xl font-bold text-cyan-300 mt-0.5">
                      +{conditionalResult.winRateEdgePct}%
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Win rate improvement
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-center">
                    <div className="text-[10px] text-slate-400">Severe Loss Prob (&lt;-2%)</div>
                    <div className="text-2xl font-bold text-rose-400 mt-0.5">
                      {conditionalResult.severeLossProbability}%
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      vs {conditionalResult.baselineSevereLossProbability}% baseline
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-center">
                    <div className="text-[10px] text-slate-400">Current Universe Match</div>
                    <div className="text-2xl font-bold text-slate-100 mt-0.5">
                      {conditionalResult.matchedSamples}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      of {conditionalResult.totalPopulation} stocks ({conditionalResult.matchRatePct}%)
                    </div>
                  </div>
                </div>

                {conditionalResult.sampleWarning && (
                  <div className="mt-4 p-3 rounded-lg bg-amber-950/40 border border-amber-500/40 text-amber-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>{conditionalResult.sampleWarning}</span>
                  </div>
                )}
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs font-mono">
                  <span className="font-bold text-slate-300 uppercase">
                    Stocks Meeting ALL Selected Criteria ({conditionalResult.matchedSamples})
                  </span>
                  <span className="text-slate-500">Current Research Universe</span>
                </div>

                <div className="divide-y divide-slate-800/60 mt-2">
                  {conditionalEvaluation.matchingStocks.map(stk => (
                    <div key={stk.ticker} className="py-3 flex items-center justify-between gap-3 text-xs font-mono">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setProfileStock(stk)}
                          className="w-10 h-10 rounded-lg bg-slate-950 border border-slate-700 flex items-center justify-center font-bold text-emerald-400 hover:border-emerald-400 transition"
                        >
                          {stk.ticker}
                        </button>
                        <div>
                          <div className="font-bold text-slate-100 font-sans text-sm">{stk.name}</div>
                          <div className="text-[11px] text-slate-400">
                            Rp {stk.price.toLocaleString('id-ID')} | {stk.sector}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                          <div className="text-slate-400 text-[10px]">Overnight Score</div>
                          <div className="font-bold text-emerald-400">{stk.overnightEdgeScore}/100</div>
                        </div>
                        <div className="text-right hidden sm:block">
                          <div className="text-slate-400 text-[10px]">Green Open Prob</div>
                          <div className="font-bold text-slate-200">{stk.historicalStats.greenOpenRate}%</div>
                        </div>
                        <button
                          onClick={() => onSelectStock(stk.ticker)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition"
                        >
                          Analyze
                        </button>
                      </div>
                    </div>
                  ))}

                  {conditionalResult.matchedSamples === 0 && (
                    <div className="py-8 text-center text-slate-500 text-xs">
                      No stocks currently meet this exact filter combination. Try loosening one or two conditions.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'SETUP_DISCOVERY' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            <span className="font-bold text-emerald-400 font-mono uppercase tracking-wider block mb-1">
              Automated Setup Discovery Engine
            </span>
            <p className="text-slate-400">
              Scans multi-variable condition intersections across historical and current IDX market structure to surface setups with high positive expectation and low tail risk.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {discoveredSetups.map((setup, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs font-mono mb-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-bold border border-emerald-500/30">
                      Rank #{idx + 1}
                    </span>
                    <span className="text-slate-400">
                      Matched: <strong className="text-slate-200">{setup.matchedSamples} stocks</strong>
                    </span>
                  </div>

                  <div className="space-y-1 my-3">
                    {setup.conditionNames.map((cName, cIdx) => (
                      <div key={cIdx} className="flex items-center gap-1.5 text-xs text-slate-200 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>{cName}</span>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono my-3">
                    <div className="p-2 rounded bg-slate-950 border border-slate-800">
                      <div className="text-[10px] text-slate-400">Win Rate</div>
                      <div className="font-bold text-emerald-400">{setup.conditionalWinRate}%</div>
                    </div>
                    <div className="p-2 rounded bg-slate-950 border border-slate-800">
                      <div className="text-[10px] text-slate-400">Win Rate Edge</div>
                      <div className="font-bold text-cyan-300">+{setup.winRateEdgePct}%</div>
                    </div>
                    <div className="p-2 rounded bg-slate-950 border border-slate-800">
                      <div className="text-[10px] text-slate-400">Severe Loss</div>
                      <div className="font-bold text-rose-400">{setup.severeLossProbability}%</div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setSelectedConditionIds(setup.conditionIds);
                    setActiveTab('CONDITIONAL_PROB');
                  }}
                  className="w-full mt-2 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold font-mono transition border border-slate-700 flex items-center justify-center gap-1.5"
                >
                  <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                  Load into Probability Workbench
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'ANALOGS' && targetStock && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <History className="w-5 h-5 text-emerald-400" />
              <div>
                <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">Target Stock for Pattern Matching</span>
                <div className="text-base font-bold text-slate-100">
                  {targetStock.ticker} — {targetStock.name} (Rp {targetStock.price.toLocaleString('id-ID')})
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-slate-400">Select Stock:</span>
              <select
                value={targetTicker}
                onChange={(e) => setTargetTicker(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 font-mono text-xs focus:outline-none focus:border-emerald-500"
              >
                {universe.map(s => (
                  <option key={s.ticker} value={s.ticker}>
                    {s.ticker} - {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {analogs.map((analog) => (
              <div
                key={analog.id}
                className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-mono">
                    <span className="font-bold text-slate-100">{analog.matchedTicker}</span>
                    <span className="text-slate-400">{analog.matchedDate}</span>
                  </div>

                  <div className="my-3 flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">Structural Similarity:</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-bold border border-emerald-500/40">
                      {analog.similarityPct}% match
                    </span>
                  </div>

                  <div className="space-y-1 mb-3">
                    {analog.setupFactors.map((factor, index) => (
                      <div key={index} className="text-[11px] text-slate-300 flex items-center gap-1.5">
                        <span className="text-emerald-400 font-bold">•</span>
                        <span>{factor}</span>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-4 gap-1.5 text-center text-xs font-mono my-3 p-2 rounded bg-slate-950 border border-slate-800">
                    <div>
                      <div className="text-[10px] text-slate-400">+1D</div>
                      <div className={`font-bold ${analog.nextDayReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {analog.nextDayReturnPct >= 0 ? '+' : ''}{analog.nextDayReturnPct}%
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">+3D</div>
                      <div className={`font-bold ${analog.next3DayReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {analog.next3DayReturnPct >= 0 ? '+' : ''}{analog.next3DayReturnPct}%
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">+5D</div>
                      <div className={`font-bold ${analog.next5DayReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {analog.next5DayReturnPct >= 0 ? '+' : ''}{analog.next5DayReturnPct}%
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">Max DD</div>
                      <div className="font-bold text-rose-400">
                        {analog.maxDrawdownPct}%
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 font-mono flex items-center justify-between">
                  <span>Outcome: {analog.wasProfitable ? '✅ Win' : '❌ Loss'}</span>
                  <span>{analog.notes}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
