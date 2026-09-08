import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  RefreshCw, 
  Sliders, 
  ChevronDown, 
  Search, 
  CheckCircle2, 
  Menu,
  Activity,
  Layers,
  Sparkles
} from 'lucide-react';
import { StockData } from '../types';

interface TopMarketBarProps {
  universe: StockData[];
  selectedTicker: string;
  onSelectStock: (ticker: string) => void;
  onRefreshData: () => void;
  onOpenSettings: () => void;
  onToggleSidebar: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const TopMarketBar: React.FC<TopMarketBarProps> = ({
  universe,
  selectedTicker,
  onSelectStock,
  onRefreshData,
  onOpenSettings,
  onToggleSidebar,
  activeTab,
  setActiveTab,
}) => {
  const [wibTime, setWibTime] = useState<string>('');
  const [tickerSearchOpen, setTickerSearchOpen] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      };
      setWibTime(new Intl.DateTimeFormat('en-GB', options).format(now) + ' WIB');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const totalScanned = universe.length;
  const prefilterPassedCount = universe.filter(s => s.prefilterPassed).length;
  const qualifiedCount = universe.filter(s => s.overnightEdgeScore >= 55 && s.prefilterPassed).length;

  return (
    <header className="h-13 px-3 bg-[#07101F] border-b border-[#22304A] flex items-center justify-between gap-2 z-20 shrink-0 text-slate-200">
      
      {/* Left side: Hamburger toggle + App Brand + Market Status */}
      <div className="flex items-center gap-2.5 overflow-hidden">
        <button
          onClick={onToggleSidebar}
          title="Toggle Navigation Sidebar"
          className="p-1.5 rounded hover:bg-[#101B2D] text-slate-400 hover:text-slate-100 border border-transparent hover:border-[#22304A] transition"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-100 text-xs tracking-wider hidden sm:inline">
            OVERNIGHT EDGE
          </span>
          <span className="text-slate-500 hidden sm:inline">•</span>

          {/* Market Status Pill */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-[11px] font-semibold text-emerald-300">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-mono">IDX • OPEN</span>
          </div>
        </div>

        {/* Jakarta WIB Time */}
        <div className="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#0D1727] border border-[#1A263C] text-[11px] font-mono text-cyan-300">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <span>{wibTime || '15:45:00 WIB'}</span>
        </div>

        {/* Data & ML Indicators */}
        <div className="hidden xl:flex items-center gap-1.5">
          <span className="px-2 py-0.5 rounded bg-[#0D1727] border border-[#1A263C] text-[10px] font-mono text-amber-300">
            DATA: MOCK
          </span>
          <span className="px-2 py-0.5 rounded bg-violet-950/60 border border-violet-500/30 text-[10px] font-mono text-violet-300">
            ML: SIMULATED
          </span>
        </div>
      </div>

      {/* Middle side: Scanning stats & Regime context */}
      <div className="hidden lg:flex items-center gap-2 font-mono text-[11px]">
        <div className="flex items-center gap-1 bg-[#0D1727] px-2 py-0.5 rounded border border-[#1A263C]">
          <span className="text-slate-400">UNIVERSE:</span>
          <span className="text-slate-100 font-bold">{totalScanned} SCANNED</span>
        </div>

        <div className="flex items-center gap-1 bg-[#0D1727] px-2 py-0.5 rounded border border-[#1A263C]">
          <span className="text-slate-400">PASSED:</span>
          <span className="text-emerald-400 font-bold">{prefilterPassedCount}</span>
        </div>

        <div className="flex items-center gap-1 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/40">
          <span className="text-emerald-400 font-medium">QUALIFIED:</span>
          <span className="text-emerald-300 font-bold">{qualifiedCount} STOCKS</span>
        </div>

        <div className="hidden 2xl:flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-[#101B2D] border border-cyan-500/30 text-cyan-300 text-[11px]">
          <span className="text-slate-400">REGIME:</span>
          <span className="font-bold">BULL EXPANSION (68%)</span>
        </div>

        <div className="hidden 2xl:flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-[#101B2D] border border-[#22304A] text-slate-300 text-[11px]">
          <span className="text-slate-400">STRATEGY:</span>
          <span className="font-semibold text-emerald-300">TREND FOLLOWING</span>
        </div>
      </div>

      {/* Right side: Ticker Quick Switcher + Action Controls */}
      <div className="flex items-center gap-2">
        {/* Quick Ticker Jumper */}
        <div className="relative">
          <select
            value={selectedTicker}
            onChange={(e) => {
              onSelectStock(e.target.value);
            }}
            className="bg-[#0D1727] hover:bg-[#101B2D] border border-[#22304A] text-emerald-300 font-mono text-xs font-bold rounded px-2.5 py-1 focus:outline-hidden focus:border-emerald-500 transition cursor-pointer"
            title="Jump to Stock Analysis"
          >
            {universe.map((stock) => (
              <option key={stock.ticker} value={stock.ticker} className="bg-[#07101F] text-slate-200">
                {stock.ticker} • {stock.overnightEdgeScore} pts
              </option>
            ))}
          </select>
        </div>

        {/* Recalculate Button */}
        <button
          onClick={onRefreshData}
          title="Recalculate models & live auction ticks"
          className="p-1.5 rounded bg-[#0D1727] hover:bg-[#101B2D] text-slate-300 hover:text-emerald-300 border border-[#22304A] transition flex items-center gap-1 text-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span className="hidden xl:inline text-[11px]">Recalculate</span>
        </button>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          title="Quant Engine & Scoring Settings"
          className="p-1.5 rounded bg-[#0D1727] hover:bg-[#101B2D] text-slate-300 hover:text-cyan-300 border border-[#22304A] transition flex items-center gap-1 text-xs"
        >
          <Sliders className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden xl:inline text-[11px]">Weights</span>
        </button>
      </div>

    </header>
  );
};
