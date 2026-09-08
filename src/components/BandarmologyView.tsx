import React, { useState } from 'react';
import { 
  Briefcase, 
  TrendingUp, 
  TrendingDown, 
  ShieldCheck, 
  AlertCircle, 
  Search, 
  Info,
  ArrowRight
} from 'lucide-react';
import { StockData, BandarmologyStatus } from '../types';

interface BandarmologyViewProps {
  universe: StockData[];
  onSelectStock: (ticker: string) => void;
}

export const BandarmologyView: React.FC<BandarmologyViewProps> = ({
  universe,
  onSelectStock,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | BandarmologyStatus>('ALL');
  const [search, setSearch] = useState('');

  const filteredList = universe.filter(s => {
    if (selectedStatus !== 'ALL' && s.bandarmology.status !== selectedStatus) return false;
    if (search && !s.ticker.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a, b) => b.bandarmology.score - a.bandarmology.score);

  const getStatusStyle = (status: BandarmologyStatus) => {
    switch (status) {
      case 'STRONG ACCUMULATION':
        return 'bg-emerald-950 text-emerald-300 border-emerald-500/80';
      case 'ACCUMULATION':
        return 'bg-emerald-950/60 text-emerald-400 border-emerald-700/60';
      case 'NEUTRAL':
        return 'bg-slate-800 text-slate-300 border-slate-700';
      case 'DISTRIBUTION':
        return 'bg-rose-950/60 text-rose-300 border-rose-800/60';
      case 'STRONG DISTRIBUTION':
        return 'bg-rose-950 text-rose-300 border-rose-600/80';
    }
  };

  return (
    <div className="w-full space-y-4 text-slate-200">
      
      {/* Title & Warning Callout */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 font-mono text-xs font-bold border border-cyan-800/60">
              BROKER SUMMARY & ACCUMULATION
            </span>
            <span className="text-[11px] font-mono text-amber-300 bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded">
              DEMO / MOCK DATA
            </span>
          </div>
          <h1 className="text-base sm:text-lg font-bold text-slate-100 uppercase tracking-wide">
            IDX Bandarmology & Institutional Order Flow Matrix
          </h1>
          <p className="text-xs text-slate-400">
            Identifies top buyer/seller broker concentrations and foreign inflows at 15:45 WIB. Used as confirmation for overnight setups, never as a lone standalone signal.
          </p>
        </div>

        <div className="bg-amber-950/30 border border-amber-900/50 p-2.5 rounded text-xs text-amber-300/90 max-w-xs">
          <strong className="block mb-0.5 text-amber-300">Confirmation Rule:</strong>
          Bandarmology acts as a multiplier filter for the Overnight Edge Score.
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search ticker..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded pl-8 pr-3 py-1.5 text-xs text-slate-200"
            />
          </div>

          <div className="flex flex-wrap gap-1">
            {(['ALL', 'STRONG ACCUMULATION', 'ACCUMULATION', 'NEUTRAL', 'DISTRIBUTION', 'STRONG DISTRIBUTION'] as const).map(st => (
              <button
                key={st}
                onClick={() => setSelectedStatus(st)}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition ${
                  selectedStatus === st ? 'bg-slate-700 text-white' : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <span className="text-[11px] font-mono text-slate-400">
          Showing <strong className="text-slate-200">{filteredList.length}</strong> stocks
        </span>
      </div>

      {/* Bandarmology Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-800">
                <th className="py-3 px-3">Ticker</th>
                <th className="py-3 px-3 text-right">Price</th>
                <th className="py-3 px-3 text-right">Daily %</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-center">Top 3 Buyer %</th>
                <th className="py-3 px-3 text-center">Top 3 Seller %</th>
                <th className="py-3 px-3 text-center font-bold">Diff %</th>
                <th className="py-3 px-3 text-right">Net Foreign Flow</th>
                <th className="py-3 px-3 text-center">Streak</th>
                <th className="py-3 px-3 text-center">Large Tx %</th>
                <th className="py-3 px-3 text-center font-bold text-emerald-400">Bandar Score</th>
                <th className="py-3 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-mono">
              {filteredList.map(stock => {
                const b = stock.bandarmology;
                const isAccum = b.status.includes('ACCUMULATION');
                const isDist = b.status.includes('DISTRIBUTION');

                return (
                  <tr 
                    key={stock.ticker}
                    className="hover:bg-slate-800/40 transition cursor-pointer"
                    onClick={() => onSelectStock(stock.ticker)}
                  >
                    <td className="py-3 px-3">
                      <div className="flex flex-col">
                        <span className="font-black text-slate-100 text-sm tracking-wider">
                          {stock.ticker}
                        </span>
                        <span className="text-[10px] text-slate-400 font-sans truncate max-w-[120px]">
                          {stock.name}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-3 text-right font-bold text-slate-200">
                      Rp {stock.price.toLocaleString('id-ID')}
                    </td>

                    <td className="py-3 px-3 text-right font-bold">
                      <span className={stock.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {stock.changePct >= 0 ? `+${stock.changePct}%` : `${stock.changePct}%`}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-center font-sans">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusStyle(b.status)}`}>
                        {b.status}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-center text-slate-300">
                      {b.top3BuyerConcentration}%
                    </td>

                    <td className="py-3 px-3 text-center text-slate-300">
                      {b.top3SellerConcentration}%
                    </td>

                    <td className="py-3 px-3 text-center font-bold">
                      <span className={b.brokerConcentrationDiff > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {b.brokerConcentrationDiff > 0 ? `+${b.brokerConcentrationDiff}%` : `${b.brokerConcentrationDiff}%`}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right font-bold">
                      <span className={b.netForeignFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {b.netForeignFlow >= 0 ? '+' : ''}Rp {(b.netForeignFlow / 1e9).toFixed(1)}B
                      </span>
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[11px] ${
                        b.accumulationStreakDays >= 3 ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60' : 'text-slate-400'
                      }`}>
                        {b.accumulationStreakDays}D
                      </span>
                    </td>

                    <td className="py-3 px-3 text-center text-slate-300">
                      {b.largeTxPercentage}%
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded font-black text-xs ${
                        b.score >= 75 ? 'bg-emerald-500 text-slate-950' : b.score >= 50 ? 'bg-slate-800 text-slate-200' : 'bg-rose-950 text-rose-300'
                      }`}>
                        {b.score}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-center" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => onSelectStock(stock.ticker)}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-semibold transition"
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
  );
};
