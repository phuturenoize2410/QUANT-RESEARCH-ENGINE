import React, { useState, useMemo } from 'react';
import { 
  Filter, 
  Search, 
  ArrowUpDown, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  ExternalLink,
  SlidersHorizontal,
  Info
} from 'lucide-react';
import { StockData } from '../types';

interface TodaysScreenerViewProps {
  universe: StockData[];
  onSelectStock: (ticker: string) => void;
  onNavigateToShortlist: () => void;
}

type SortField = 
  | 'prefilterScore'
  | 'turnover'
  | 'relativeVolume'
  | 'changePct'
  | 'price'
  | 'technicalScore'
  | 'ticker'
  | 'closePositionInRange';

export const TodaysScreenerView: React.FC<TodaysScreenerViewProps> = ({
  universe,
  onSelectStock,
  onNavigateToShortlist,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PASSED' | 'FILTERED'>('ALL');
  const [sectorFilter, setSectorFilter] = useState<string>('ALL');
  const [sortField, setSortField] = useState<SortField>('prefilterScore');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const sectors = useMemo(() => {
    const list = Array.from(new Set(universe.map(s => s.sector)));
    return ['ALL', ...list.sort()];
  }, [universe]);

  const filteredStocks = useMemo(() => {
    return universe.filter(stock => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesTicker = stock.ticker.toLowerCase().includes(q);
        const matchesName = stock.name.toLowerCase().includes(q);
        if (!matchesTicker && !matchesName) return false;
      }
      if (statusFilter === 'PASSED' && !stock.prefilterPassed) return false;
      if (statusFilter === 'FILTERED' && stock.prefilterPassed) return false;
      if (sectorFilter !== 'ALL' && stock.sector !== sectorFilter) return false;
      return true;
    }).sort((a, b) => {
      let valA: any = a[sortField as keyof StockData];
      let valB: any = b[sortField as keyof StockData];

      if (sortField === 'closePositionInRange') {
        valA = a.technical.closePositionInRange;
        valB = b.technical.closePositionInRange;
      } else if (sortField === 'technicalScore') {
        valA = a.technicalScore;
        valB = b.technicalScore;
      }

      if (typeof valA === 'string') {
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });
  }, [universe, searchQuery, statusFilter, sectorFilter, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const passedCount = universe.filter(s => s.prefilterPassed).length;
  const filteredCount = universe.filter(s => !s.prefilterPassed).length;

  return (
    <div className="w-full space-y-4 text-slate-200">
      
      {/* Page Title & Context Banner */}
      <div className="bg-[#101B2D] border border-[#22304A] rounded-md p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 text-xs font-bold border border-cyan-800/60">
              STAGE 1 — 15:30 WIB
            </span>
            <h1 className="text-base font-semibold text-slate-100 uppercase tracking-wide">
              Universe Screener & Pre-Filter
            </h1>
          </div>
          <p className="text-xs text-slate-400">
            Initial filtration across the IDX universe. Discards illiquid issues, overextended spikes, poor candle closes, and erratic volatility before 15:45 shortlist.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-slate-400 font-sans">Status:</span>
            <span className="text-emerald-400 font-bold">{passedCount} Passed</span>
            <span className="text-slate-600">/</span>
            <span className="text-rose-400 font-bold">{filteredCount} Filtered</span>
          </div>
          <button
            onClick={onNavigateToShortlist}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded text-xs font-medium transition"
          >
            Go to 15:45 Shortlist &rarr;
          </button>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-[#101B2D] border border-[#22304A] rounded-md p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[260px]">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search ticker (e.g. BBCA, ANTM)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-[#0D1727] border border-[#22304A] rounded pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:border-emerald-500 focus:outline-hidden"
            />
          </div>

          {/* Status Segmented Buttons */}
          <div className="flex bg-[#0D1727] border border-[#22304A] rounded p-0.5">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                statusFilter === 'ALL' ? 'bg-[#1A263C] text-slate-100' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({universe.length})
            </button>
            <button
              onClick={() => setStatusFilter('PASSED')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                statusFilter === 'PASSED' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Passed ({passedCount})
            </button>
            <button
              onClick={() => setStatusFilter('FILTERED')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                statusFilter === 'FILTERED' ? 'bg-rose-950 text-rose-300 border border-rose-800/60' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Filtered ({filteredCount})
            </button>
          </div>

          {/* Sector Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 text-xs hidden sm:inline">Sector:</span>
            <select
              value={sectorFilter}
              onChange={e => setSectorFilter(e.target.value)}
              className="bg-[#0D1727] border border-[#22304A] rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-hidden"
            >
              {sectors.map(sec => (
                <option key={sec} value={sec}>{sec}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-[11px] text-slate-400">
          Showing <span className="text-slate-200 font-bold font-mono">{filteredStocks.length}</span> of <span className="font-mono">{universe.length}</span> stocks
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-[#101B2D] border border-[#22304A] rounded-md overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#0A1322] text-slate-400 uppercase text-[11px] tracking-wider border-b border-[#22304A] select-none sticky top-0 z-10 font-medium">
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3 cursor-pointer hover:text-slate-200" onClick={() => handleSort('ticker')}>
                  <div className="flex items-center gap-1">Ticker <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th className="py-2.5 px-3 text-right cursor-pointer hover:text-slate-200" onClick={() => handleSort('price')}>
                  <div className="flex items-center justify-end gap-1">Price <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th className="py-2.5 px-3 text-right cursor-pointer hover:text-slate-200" onClick={() => handleSort('changePct')}>
                  <div className="flex items-center justify-end gap-1">Daily % <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th className="py-2.5 px-3 text-right cursor-pointer hover:text-slate-200" onClick={() => handleSort('relativeVolume')}>
                  <div className="flex items-center justify-end gap-1">Rel Vol <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th className="py-2.5 px-3 text-right cursor-pointer hover:text-slate-200" onClick={() => handleSort('turnover')}>
                  <div className="flex items-center justify-end gap-1">Turnover <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th className="py-2.5 px-3 text-right">52W High Dist</th>
                <th className="py-2.5 px-3 text-center cursor-pointer hover:text-slate-200" onClick={() => handleSort('closePositionInRange')}>
                  <div className="flex items-center justify-center gap-1">Close in Range <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th className="py-2.5 px-3 text-center">Momentum 5D</th>
                <th className="py-2.5 px-3 text-center">Not Extended?</th>
                <th className="py-2.5 px-3 text-center cursor-pointer hover:text-slate-200" onClick={() => handleSort('technicalScore')}>
                  <div className="flex items-center justify-center gap-1">Tech Score <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th className="py-2.5 px-3 text-center cursor-pointer hover:text-slate-200" onClick={() => handleSort('prefilterScore')}>
                  <div className="flex items-center justify-center gap-1">Prefilter Score <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th className="py-2.5 px-3 text-center">Status & Notes</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A263C]">
              {filteredStocks.map((stock, idx) => {
                const isPassed = stock.prefilterPassed;
                const closePosPct = Math.round(stock.technical.closePositionInRange * 100);

                return (
                  <tr 
                    key={stock.ticker}
                    className={`hover:bg-[#1A263C]/60 transition cursor-pointer ${
                      isPassed ? 'bg-[#101B2D]' : 'bg-[#0D1727] opacity-75 hover:opacity-100'
                    }`}
                    onClick={() => onSelectStock(stock.ticker)}
                  >
                    <td className="py-2 px-3 text-slate-400 font-mono">{idx + 1}</td>
                    
                    {/* Ticker & Sector */}
                    <td className="py-2 px-3">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-100 text-xs tracking-wider">
                          {stock.ticker}
                        </span>
                        <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                          {stock.name}
                        </span>
                      </div>
                    </td>

                    {/* Price */}
                    <td className="py-2 px-3 text-right font-mono font-medium text-slate-100">
                      Rp {stock.price.toLocaleString('id-ID')}
                    </td>

                    {/* Daily % */}
                    <td className="py-2 px-3 text-right font-mono font-medium">
                      <span className={`px-1.5 py-0.5 rounded ${
                        stock.changePct > 0 
                          ? 'text-emerald-400 bg-emerald-950/40' 
                          : stock.changePct < 0 
                          ? 'text-rose-400 bg-rose-950/40' 
                          : 'text-slate-400'
                      }`}>
                        {stock.changePct > 0 ? `+${stock.changePct.toFixed(2)}%` : `${stock.changePct.toFixed(2)}%`}
                      </span>
                    </td>

                    {/* Rel Vol */}
                    <td className="py-2 px-3 text-right font-mono">
                      <span className={`font-medium ${
                        stock.relativeVolume >= 1.5 
                          ? 'text-emerald-400 font-bold' 
                          : stock.relativeVolume < 0.9 
                          ? 'text-rose-400' 
                          : 'text-slate-300'
                      }`}>
                        {stock.relativeVolume.toFixed(2)}x
                      </span>
                    </td>

                    {/* Turnover */}
                    <td className="py-2 px-3 text-right font-mono text-slate-300">
                      Rp {(stock.turnover / 1e9).toFixed(1)}B
                    </td>

                    {/* 52W High Dist */}
                    <td className="py-2 px-3 text-right font-mono text-slate-400">
                      {stock.technical.distFrom52wHigh.toFixed(1)}%
                    </td>

                    {/* Close in Range */}
                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5 font-mono">
                        <div className="w-12 bg-[#1A263C] rounded-full h-1.5 overflow-hidden">
                          <div 
                            className={`h-full ${closePosPct >= 80 ? 'bg-emerald-400' : closePosPct >= 50 ? 'bg-amber-400' : 'bg-rose-400'}`}
                            style={{ width: `${closePosPct}%` }}
                          />
                        </div>
                        <span className={`text-[10px] font-bold ${closePosPct >= 80 ? 'text-emerald-300' : 'text-slate-400'}`}>
                          {closePosPct}%
                        </span>
                      </div>
                    </td>

                    {/* Momentum 5D */}
                    <td className="py-2 px-3 text-center font-mono">
                      <span className={`${stock.technical.momentum5d > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {stock.technical.momentum5d > 0 ? `+${stock.technical.momentum5d}%` : `${stock.technical.momentum5d}%`}
                      </span>
                    </td>

                    {/* Not Extended? */}
                    <td className="py-2 px-3 text-center">
                      {!stock.technical.isExtended ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 font-mono">
                          YES (RSI {Math.round(stock.technical.rsi14)})
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-950/60 text-rose-300 border border-rose-800/40">
                          EXTENDED
                        </span>
                      )}
                    </td>

                    {/* Technical Score */}
                    <td className="py-2 px-3 text-center font-mono font-medium text-slate-200">
                      {stock.technicalScore}
                    </td>

                    {/* Prefilter Score */}
                    <td className="py-2 px-3 text-center font-mono">
                      <span className={`px-2 py-0.5 rounded font-bold ${
                        stock.prefilterScore >= 75 
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/50' 
                          : stock.prefilterScore >= 50 
                          ? 'bg-amber-950 text-amber-300 border border-amber-700/50' 
                          : 'bg-rose-950 text-rose-300 border border-rose-700/50'
                      }`}>
                        {stock.prefilterScore}
                      </span>
                    </td>

                    {/* Status & Fail Reasons */}
                    <td className="py-2 px-3 text-center">
                      {isPassed ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60 text-[10px] font-bold">
                          <CheckCircle className="w-3 h-3 text-emerald-400" />
                          PASSED
                        </span>
                      ) : (
                        <div className="flex flex-col items-center">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800/60 text-[10px] font-bold">
                            <XCircle className="w-3 h-3 text-rose-400" />
                            FILTERED OUT
                          </span>
                          {stock.prefilterFailReasons.length > 0 && (
                            <span className="text-[9px] text-rose-400/80 truncate max-w-[130px] mt-0.5" title={stock.prefilterFailReasons.join('; ')}>
                              {stock.prefilterFailReasons[0]}
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-2 px-3 text-center" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => onSelectStock(stock.ticker)}
                        className="px-2 py-1 rounded bg-[#1A263C] hover:bg-slate-700 text-slate-300 hover:text-white transition text-[11px] font-medium"
                      >
                        Analyze
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
  );
};
