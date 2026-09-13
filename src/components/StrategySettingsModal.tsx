import React from 'react';
import { X, RotateCcw, Sliders, Shield, AlertTriangle, Coins, Check } from 'lucide-react';
import { StrategySettings } from '../types';
import { ExecutionCostSettingKey } from '../application/researchApplication';

interface StrategySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: StrategySettings;
  defaultSettings: StrategySettings;
  calculateExecutionFrictionPct: (settings: StrategySettings) => number;
  applyExecutionCostInput: (
    settings: StrategySettings,
    key: ExecutionCostSettingKey,
    rawValue: string,
  ) => StrategySettings;
  onSave: (newSettings: StrategySettings) => void;
}

export const StrategySettingsModal: React.FC<StrategySettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  defaultSettings,
  calculateExecutionFrictionPct,
  applyExecutionCostInput,
  onSave
}) => {
  const [localSettings, setLocalSettings] = React.useState<StrategySettings>(settings);

  React.useEffect(() => {
    setLocalSettings(settings);
  }, [settings, isOpen]);

  if (!isOpen) return null;

  const handleChange = (key: keyof StrategySettings, value: number) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleExecutionCostChange = (key: ExecutionCostSettingKey, rawValue: string) => {
    setLocalSettings(prev => applyExecutionCostInput(prev, key, rawValue));
  };

  const handleReset = () => {
    setLocalSettings({ ...defaultSettings });
  };

  const handleApply = () => {
    onSave(localSettings);
    onClose();
  };

  const totalExecutionFriction = calculateExecutionFrictionPct(localSettings);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col text-slate-200">
        
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                Strategy Scoring Weights & Execution Parameters
              </h2>
              <p className="text-[11px] text-slate-400">
                Tune Overnight Edge Score weights, gap-down penalty multipliers, and IDX transaction frictions.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-6 text-xs">
          
          {/* Section 1: Positive Components */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <span className="font-bold text-slate-200 uppercase tracking-wide flex items-center gap-1.5 text-xs">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                Positive Component Weights (Total: {localSettings.greenOpenProbWeight + localSettings.expectedNetReturnWeight + localSettings.historicalConsistencyWeight + localSettings.technicalQualityWeight + localSettings.liquidityWeight + localSettings.bandarmologyWeight}%)
              </span>
              <span className="text-[10px] text-slate-400">Normalized in score</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex justify-between font-mono">
                  <span className="text-slate-300">Green Open Probability</span>
                  <span className="text-emerald-400 font-bold">{localSettings.greenOpenProbWeight}%</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="50"
                  value={localSettings.greenOpenProbWeight}
                  onChange={e => handleChange('greenOpenProbWeight', Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <p className="text-[10px] text-slate-500">Rewards high % of positive next-day opening ticks.</p>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between font-mono">
                  <span className="text-slate-300">Expected Net Return</span>
                  <span className="text-emerald-400 font-bold">{localSettings.expectedNetReturnWeight}%</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="35"
                  value={localSettings.expectedNetReturnWeight}
                  onChange={e => handleChange('expectedNetReturnWeight', Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <p className="text-[10px] text-slate-500">Historical average net gap after buy/sell fees.</p>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between font-mono">
                  <span className="text-slate-300">Historical Consistency & Sample</span>
                  <span className="text-emerald-400 font-bold">{localSettings.historicalConsistencyWeight}%</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="35"
                  value={localSettings.historicalConsistencyWeight}
                  onChange={e => handleChange('historicalConsistencyWeight', Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <p className="text-[10px] text-slate-500">Penalizes low observation count (&lt;20 matches).</p>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between font-mono">
                  <span className="text-slate-300">Technical Quality Score</span>
                  <span className="text-emerald-400 font-bold">{localSettings.technicalQualityWeight}%</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="30"
                  value={localSettings.technicalQualityWeight}
                  onChange={e => handleChange('technicalQualityWeight', Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <p className="text-[10px] text-slate-500">Close near high, rel volume, moving averages.</p>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between font-mono">
                  <span className="text-slate-300">Turnover / Liquidity Depth</span>
                  <span className="text-emerald-400 font-bold">{localSettings.liquidityWeight}%</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="25"
                  value={localSettings.liquidityWeight}
                  onChange={e => handleChange('liquidityWeight', Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <p className="text-[10px] text-slate-500">Ensures easy execution at 15:45 & 09:00 WIB.</p>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between font-mono">
                  <span className="text-slate-300">Bandarmology / Accumulation</span>
                  <span className="text-emerald-400 font-bold">{localSettings.bandarmologyWeight}%</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="30"
                  value={localSettings.bandarmologyWeight}
                  onChange={e => handleChange('bandarmologyWeight', Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <p className="text-[10px] text-slate-500">Broker concentration diff & foreign desk flows.</p>
              </div>
            </div>
          </div>

          {/* Section 2: Gap-Down Tail Risk Penalties */}
          <div className="space-y-3 bg-rose-950/20 p-3.5 rounded border border-rose-900/40">
            <div className="flex items-center justify-between border-b border-rose-900/40 pb-1.5">
              <span className="font-bold text-rose-300 uppercase tracking-wide flex items-center gap-1.5 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                Gap-Down Risk Penalties (Subtracted from Edge Score)
              </span>
              <span className="text-[10px] text-rose-400 font-mono">Strategy: Cut-loss on red open</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex justify-between font-mono">
                  <span className="text-slate-300">Bad Gap (&lt; -1.0%) Penalty</span>
                  <span className="text-rose-400 font-bold">-{localSettings.badGapPenaltyWeight} pts</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="60"
                  value={localSettings.badGapPenaltyWeight}
                  onChange={e => handleChange('badGapPenaltyWeight', Number(e.target.value))}
                  className="w-full accent-rose-500 cursor-pointer"
                />
                <p className="text-[10px] text-slate-400">Deducts score when historical bad gap probability rises.</p>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between font-mono">
                  <span className="text-slate-300">Severe Gap (&lt; -2.0%) Penalty</span>
                  <span className="text-rose-400 font-bold">-{localSettings.severeGapPenaltyWeight} pts</span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="80"
                  value={localSettings.severeGapPenaltyWeight}
                  onChange={e => handleChange('severeGapPenaltyWeight', Number(e.target.value))}
                  className="w-full accent-rose-500 cursor-pointer"
                />
                <p className="text-[10px] text-slate-400">Strict penalty against dangerous opening tail risks.</p>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between font-mono">
                  <span className="text-slate-300">Worst Historical Gap Penalty</span>
                  <span className="text-rose-400 font-bold">-{localSettings.extremeTailPenaltyWeight} pts</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="70"
                  value={localSettings.extremeTailPenaltyWeight}
                  onChange={e => handleChange('extremeTailPenaltyWeight', Number(e.target.value))}
                  className="w-full accent-rose-500 cursor-pointer"
                />
                <p className="text-[10px] text-slate-400">Penalizes stocks with historical flash gap drops &gt; -3%.</p>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between font-mono">
                  <span className="text-slate-300">Overextended Price Penalty</span>
                  <span className="text-rose-400 font-bold">-{localSettings.overextendedPenaltyWeight} pts</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="50"
                  value={localSettings.overextendedPenaltyWeight}
                  onChange={e => handleChange('overextendedPenaltyWeight', Number(e.target.value))}
                  className="w-full accent-rose-500 cursor-pointer"
                />
                <p className="text-[10px] text-slate-400">Penalizes stocks stretched &gt; 12% above 20MA or RSI &gt; 74.</p>
              </div>
            </div>
          </div>

          {/* Section 3: IDX Transaction Costs */}
          <div className="space-y-3 bg-slate-800/40 p-3.5 rounded border border-slate-700/60">
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-1.5">
              <span className="font-bold text-slate-200 uppercase tracking-wide flex items-center gap-1.5 text-xs">
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                IDX Transaction Frictions (Total: {totalExecutionFriction.toFixed(2)}%)
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Standard Broker + Levy</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Buy Fee (%)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.05"
                  max="0.5"
                  value={localSettings.buyFeePct}
                  onChange={e => handleExecutionCostChange('buyFeePct', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-slate-200 text-xs"
                />
                <span className="text-[10px] text-slate-500">IDX default ~{defaultSettings.buyFeePct.toFixed(2)}%</span>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Sell Fee (%)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  max="0.6"
                  value={localSettings.sellFeePct}
                  onChange={e => handleExecutionCostChange('sellFeePct', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-slate-200 text-xs"
                />
                <span className="text-[10px] text-slate-500">Includes applicable sell-side tax/levies</span>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Estimated Slippage (%)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="0.5"
                  value={localSettings.slippagePct}
                  onChange={e => handleExecutionCostChange('slippagePct', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-slate-200 text-xs"
                />
                <span className="text-[10px] text-slate-500">Bid-ask spread / execution impact estimate</span>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition border border-slate-700"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to Default
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition shadow-md"
            >
              <Check className="w-3.5 h-3.5" />
              Apply Changes
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
