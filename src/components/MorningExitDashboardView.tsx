import React, { useState } from 'react';
import { 
  SunMedium, 
  ArrowUpRight, 
  ArrowDownRight, 
  AlertTriangle, 
  CheckCircle2, 
  Plus, 
  Trash2, 
  DollarSign, 
  Coins,
  Clock,
  Info
} from 'lucide-react';
import { MorningPosition, ExitDecisionStatus, StockData } from '../types';

interface MorningExitDashboardViewProps {
  positions: MorningPosition[];
  onUpdatePosition: (id: string, updates: Partial<MorningPosition>) => void;
  onRemovePosition: (id: string) => void;
  onAddManualPosition: (pos: Omit<MorningPosition, 'id'>) => void;
  universe: StockData[];
  onSelectStock: (ticker: string) => void;
}

export const MorningExitDashboardView: React.FC<MorningExitDashboardViewProps> = ({
  positions,
  onUpdatePosition,
  onRemovePosition,
  onAddManualPosition,
  universe,
  onSelectStock,
}) => {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newTicker, setNewTicker] = useState('BBCA');
  const [newLots, setNewLots] = useState(100);
  const [newEntryPrice, setNewEntryPrice] = useState(10400);

  // Totals
  const totalCost = positions.reduce((sum, p) => sum + p.totalCostIDR, 0);
  const totalGrossProfit = positions.reduce((sum, p) => sum + p.grossProfitIDR, 0);
  const totalNetProfit = positions.reduce((sum, p) => sum + p.netProfitIDR, 0);
  const netReturnPct = totalCost > 0 ? (totalNetProfit / totalCost) * 100 : 0;

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const stock = universe.find(s => s.ticker === newTicker);
    const price = newEntryPrice || stock?.price || 1000;
    const currentOpen = stock ? stock.price * (1 + (stock.historicalStats.avgOvernightGap / 100)) : price * 1.008;
    const openPrice = Math.round(currentOpen);
    const gapPct = Math.round(((openPrice / price) - 1) * 1000) / 10;
    const cost = price * newLots * 100;
    const sellValue = openPrice * newLots * 100;
    const grossPL = sellValue - cost;
    const feeBuy = cost * 0.0015;
    const feeSell = sellValue * 0.0025;
    const netPL = grossPL - (feeBuy + feeSell);

    let exitStatus: ExitDecisionStatus = 'REVIEW';
    if (gapPct >= 0.8) exitStatus = 'TAKE PROFIT';
    else if (gapPct <= -0.8) exitStatus = 'CUT LOSS';
    else exitStatus = 'FLAT / EXIT';

    onAddManualPosition({
      ticker: newTicker,
      name: stock?.name || newTicker,
      purchaseDate: 'Yesterday 15:42 WIB',
      entryPrice: price,
      lots: newLots,
      totalCostIDR: cost,
      currentOpenPrice: openPrice,
      openGapPct: gapPct,
      grossProfitIDR: grossPL,
      netProfitIDR: netPL,
      netProfitPct: Math.round((netPL / cost) * 1000) / 10,
      cutLossLevel: Math.round(price * 0.985),
      takeProfitLevel: Math.round(price * 1.015),
      exitStatus,
      notes: 'Overnight position opened at 15:45 pre-close',
    });

    setIsAddOpen(false);
  };

  const getExitBadge = (status: ExitDecisionStatus) => {
    switch (status) {
      case 'TAKE PROFIT':
        return 'bg-emerald-950 text-emerald-300 border-emerald-500 font-extrabold';
      case 'FLAT / EXIT':
        return 'bg-slate-800 text-slate-300 border-slate-700';
      case 'CUT LOSS':
        return 'bg-rose-950 text-rose-300 border-rose-600 font-black animate-pulse';
      case 'REVIEW':
        return 'bg-amber-950 text-amber-300 border-amber-600';
    }
  };

  return (
    <div className="w-full space-y-4 text-slate-200">
      
      {/* Morning Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/30 border border-amber-500/40 rounded-lg p-4 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded bg-amber-500 text-slate-950 font-mono text-xs font-black tracking-wider uppercase flex items-center gap-1">
              <SunMedium className="w-3.5 h-3.5" />
              09:00 WIB MORNING EXIT DESK
            </span>
            <span className="text-xs font-mono text-slate-400">
              Positions Purchased Yesterday at 15:45 WIB
            </span>
          </div>
          <h1 className="text-base sm:text-lg font-bold text-slate-100 uppercase tracking-wide">
            Morning Opening Execution & Trade Journal
          </h1>
          <p className="text-xs text-slate-400">
            Enforce the strategy's strict exit rule: Exit immediately at market open. If open gap is negative, cut loss without hesitation.
          </p>
        </div>

        <button
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded transition shadow-md"
        >
          <Plus className="w-4 h-4" />
          Log Purchased Stock
        </button>
      </div>

      {/* Aggregate KPI Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
        <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg">
          <span className="text-slate-500 text-[10px] block">TOTAL OVERNIGHT CAPITAL</span>
          <span className="text-base font-bold text-slate-100">
            Rp {(totalCost / 1e6).toFixed(1)} Juta
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg">
          <span className="text-slate-500 text-[10px] block">GROSS P/L</span>
          <span className={`text-base font-bold ${totalGrossProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {totalGrossProfit >= 0 ? '+' : ''}Rp {Math.round(totalGrossProfit).toLocaleString('id-ID')}
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg">
          <span className="text-slate-500 text-[10px] block">NET P/L (AFTER IDX FEES)</span>
          <span className={`text-base font-black ${totalNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {totalNetProfit >= 0 ? '+' : ''}Rp {Math.round(totalNetProfit).toLocaleString('id-ID')}
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg">
          <span className="text-slate-500 text-[10px] block">NET RETURN</span>
          <span className={`text-base font-black ${netReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {netReturnPct >= 0 ? `+${netReturnPct.toFixed(2)}%` : `${netReturnPct.toFixed(2)}%`}
          </span>
        </div>
      </div>

      {/* Add Position Modal */}
      {isAddOpen && (
        <div className="bg-slate-900 border border-emerald-500/50 rounded-lg p-4 shadow-2xl space-y-3">
          <h3 className="font-bold text-slate-200 text-xs uppercase tracking-wider">
            Log New Overnight Purchase (Yesterday 15:45 Close)
          </h3>
          <form onSubmit={handleAddSubmit} className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div>
              <label className="text-slate-400 block mb-1">Ticker</label>
              <select
                value={newTicker}
                onChange={e => {
                  setNewTicker(e.target.value);
                  const s = universe.find(st => st.ticker === e.target.value);
                  if (s) setNewEntryPrice(s.price);
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 text-xs"
              >
                {universe.map(s => (
                  <option key={s.ticker} value={s.ticker}>{s.ticker} - {s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Entry Close Price (Rp)</label>
              <input
                type="number"
                value={newEntryPrice}
                onChange={e => setNewEntryPrice(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 text-xs"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Lots (1 Lot = 100 Shares)</label>
              <input
                type="number"
                value={newLots}
                onChange={e => setNewLots(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 text-xs"
              />
            </div>

            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="flex-1 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded text-xs transition"
              >
                Confirm Log
              </button>
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Positions Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <th className="py-3 px-3">Ticker</th>
                <th className="py-3 px-3 text-right">Entry Close</th>
                <th className="py-3 px-3 text-right">Lots</th>
                <th className="py-3 px-3 text-right">Capital</th>
                <th className="py-3 px-3 text-right">Today's Open</th>
                <th className="py-3 px-3 text-right">Opening Gap %</th>
                <th className="py-3 px-3 text-right">Gross P/L</th>
                <th className="py-3 px-3 text-right font-bold text-emerald-400">Net P/L</th>
                <th className="py-3 px-3 text-center">Exit Decision</th>
                <th className="py-3 px-3">Trader Notes</th>
                <th className="py-3 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {positions.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-500 font-sans">
                    No active morning positions logged. Click "Buy" on the 15:45 Final Shortlist to add yesterday's positions.
                  </td>
                </tr>
              ) : (
                positions.map(pos => {
                  const isProfit = pos.netProfitIDR >= 0;

                  return (
                    <tr key={pos.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-3 font-sans">
                        <div className="flex flex-col">
                          <span 
                            className="font-black text-slate-100 text-sm tracking-wide font-mono cursor-pointer hover:text-emerald-400"
                            onClick={() => onSelectStock(pos.ticker)}
                          >
                            {pos.ticker}
                          </span>
                          <span className="text-[10px] text-slate-400 truncate max-w-[110px]">
                            {pos.name}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-right text-slate-200">
                        Rp {pos.entryPrice.toLocaleString('id-ID')}
                      </td>

                      <td className="py-3 px-3 text-right text-slate-300">
                        {pos.lots} lots
                      </td>

                      <td className="py-3 px-3 text-right text-slate-300">
                        Rp {(pos.totalCostIDR / 1e6).toFixed(1)}M
                      </td>

                      <td className="py-3 px-3 text-right font-bold text-slate-100">
                        Rp {pos.currentOpenPrice.toLocaleString('id-ID')}
                      </td>

                      <td className="py-3 px-3 text-right font-bold">
                        <span className={`px-1.5 py-0.5 rounded ${
                          pos.openGapPct > 0 
                            ? 'bg-emerald-950 text-emerald-400' 
                            : pos.openGapPct < 0 
                            ? 'bg-rose-950 text-rose-400' 
                            : 'text-slate-400'
                        }`}>
                          {pos.openGapPct > 0 ? `+${pos.openGapPct}%` : `${pos.openGapPct}%`}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right">
                        <span className={pos.grossProfitIDR >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {pos.grossProfitIDR >= 0 ? '+' : ''}Rp {Math.round(pos.grossProfitIDR).toLocaleString('id-ID')}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right font-black">
                        <span className={isProfit ? 'text-emerald-400' : 'text-rose-400'}>
                          {isProfit ? '+' : ''}Rp {Math.round(pos.netProfitIDR).toLocaleString('id-ID')} ({isProfit ? '+' : ''}{pos.netProfitPct}%)
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center font-sans">
                        <span className={`px-2 py-0.5 rounded text-[10px] border ${getExitBadge(pos.exitStatus)}`}>
                          {pos.exitStatus}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-slate-400 font-sans text-[11px]">
                        {pos.notes}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => onRemovePosition(pos.id)}
                          title="Close / Delete Position"
                          className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
