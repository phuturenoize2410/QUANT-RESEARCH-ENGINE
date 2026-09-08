import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Settings, 
  Clock, 
  Database, 
  BarChart3, 
  Flame, 
  CheckCircle2, 
  RefreshCw,
  ExternalLink,
  Info
} from 'lucide-react';
import { StockData } from '../types';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  universe: StockData[];
  onOpenSettings: () => void;
  onRefreshData: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  universe,
  onOpenSettings,
  onRefreshData
}) => {
  const [wibTime, setWibTime] = useState<string>('');
  const [sessionStatus, setSessionStatus] = useState<'PREFILTER' | 'FINAL_SHORTLIST' | 'MORNING_OPEN'>('FINAL_SHORTLIST');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      // Format as WIB (UTC+7)
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      };
      setWibTime(new Intl.DateTimeFormat('id-ID', options).format(now) + ' WIB');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const totalScanned = universe.length;
  const prefilterPassedCount = universe.filter(s => s.prefilterPassed).length;
  const shortlistCount = universe.filter(s => s.decision === 'STRONG BUY' || s.decision === 'BUY').length;
  const topCandidate = universe.find(s => s.decision === 'STRONG BUY') || universe[0];

  const navItems = [
    { id: 'shortlist', label: '15:45 FINAL SHORTLIST', badge: shortlistCount, highlight: true },
    { id: 'ml_lab', label: 'ML LAB & ADAPTIVE AI', mlBadge: 'ML' },
    { id: 'opportunity_map', label: 'OPPORTUNITY MAP' },
    { id: 'leaderboard', label: 'STRATEGY LEADERBOARD & ENSEMBLE' },
    { id: 'quantlab', label: 'QUANT LAB & ANALOGS' },
    { id: 'screener', label: '15:30 PRE-FILTER', badge: prefilterPassedCount },
    { id: 'analysis', label: 'STOCK ANALYSIS' },
    { id: 'gapdown', label: 'GAP-DOWN LAB', alertBadge: 'RISK' },
    { id: 'backtest', label: 'OVERNIGHT BACKTEST' },
    { id: 'strategylab', label: 'STRATEGY LAB' },
    { id: 'bandarmology', label: 'BANDARMOLOGY' },
    { id: 'morning_exit', label: 'MORNING EXIT / JOURNAL' },
  ];

  return (
    <header className="bg-slate-950 border-b border-slate-800/80 sticky top-0 z-40 text-slate-200">
      {/* Topmost Institutional Terminal Bar */}
      <div className="px-4 py-2 border-b border-slate-800/60 bg-slate-900/90 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center font-black text-emerald-400 text-xs tracking-tighter">
              OE
            </div>
            <div>
              <span className="font-extrabold tracking-wider text-slate-100 text-sm">OVERNIGHT EDGE</span>
              <span className="text-[10px] text-emerald-400 font-mono ml-2 border border-emerald-500/30 px-1.5 py-0.5 rounded bg-emerald-950/40">
                IDX BUY-CLOSE / SELL-OPEN
              </span>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded text-[11px] border border-slate-700/60">
            <Database className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-400 font-medium">DATA STATUS:</span>
            <span className="text-amber-300 font-bold font-mono">DEMO / MOCK DATA</span>
            <span className="text-slate-500 text-[10px]">(54 IDX Tickers)</span>
          </div>
        </div>

        {/* Live Metrics Header Bar */}
        <div className="flex items-center gap-2 sm:gap-4 font-mono text-[11px]">
          <div className="flex items-center gap-1.5 text-slate-300 bg-slate-800/40 px-2 py-1 rounded border border-slate-800">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">WIB:</span>
            <span className="text-cyan-300 font-semibold">{wibTime || '15:45:00 WIB'}</span>
          </div>

          {/* Session Switcher Pill */}
          <div className="hidden md:flex items-center bg-slate-900 border border-slate-700/80 rounded p-0.5">
            <button
              onClick={() => setSessionStatus('PREFILTER')}
              className={`px-2 py-0.5 rounded text-[10px] font-semibold transition ${
                sessionStatus === 'PREFILTER' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              15:30 Pre-Filter
            </button>
            <button
              onClick={() => setSessionStatus('FINAL_SHORTLIST')}
              className={`px-2 py-0.5 rounded text-[10px] font-semibold transition ${
                sessionStatus === 'FINAL_SHORTLIST' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              15:45 Final Shortlist
            </button>
            <button
              onClick={() => setSessionStatus('MORNING_OPEN')}
              className={`px-2 py-0.5 rounded text-[10px] font-semibold transition ${
                sessionStatus === 'MORNING_OPEN' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              09:00 Morning Open
            </button>
          </div>

          <div className="flex items-center gap-1 bg-slate-800/60 px-2 py-1 rounded border border-slate-700/40">
            <span className="text-slate-400">SCANNED:</span>
            <span className="text-slate-200 font-bold">{totalScanned}</span>
          </div>

          <div className="flex items-center gap-1 bg-slate-800/60 px-2 py-1 rounded border border-slate-700/40">
            <span className="text-slate-400">PASSED:</span>
            <span className="text-emerald-400 font-bold">{prefilterPassedCount}</span>
          </div>

          <div className="flex items-center gap-1 bg-emerald-950/50 px-2.5 py-1 rounded border border-emerald-500/40">
            <span className="text-emerald-400 font-medium">SHORTLIST:</span>
            <span className="text-emerald-300 font-extrabold">{shortlistCount}</span>
          </div>

          <button
            onClick={onRefreshData}
            title="Recalculate with live mock ticks"
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition border border-slate-700/50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition border border-slate-700 text-[11px]"
          >
            <Settings className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Settings & Weights</span>
          </button>
        </div>
      </div>

      {/* Primary Strategic Objective Callout */}
      <div className="px-4 py-2 bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-950 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <p className="text-slate-300 font-medium">
            <strong className="text-emerald-400 font-semibold">Jam 15:45 WIB Hari Ini:</strong> Saham apa yang paling layak dibeli untuk dijual besok pagi?
          </p>
          <span className="hidden xl:inline text-slate-500 font-mono text-[11px] border-l border-slate-700/80 pl-2.5">
            Philosophy: <span className="text-amber-300 font-semibold">LOW GAP-DOWN RISK &gt; HIGH RETURN POTENTIAL</span>
          </span>
        </div>

        {topCandidate && (
          <div className="flex items-center gap-2 bg-slate-800/80 px-2.5 py-1 rounded border border-emerald-500/30 text-[11px]">
            <span className="text-slate-400">#1 Overnight Edge:</span>
            <span className="font-extrabold font-mono text-emerald-400">{topCandidate.ticker}</span>
            <span className="text-slate-300">Rp {topCandidate.price.toLocaleString('id-ID')}</span>
            <span className="text-emerald-400 font-semibold font-mono">+{topCandidate.changePct}%</span>
            <span className="text-[10px] bg-emerald-950 border border-emerald-500/40 text-emerald-300 px-1.5 py-0.2 rounded font-mono">
              Green Rate: {topCandidate.historicalStats.greenOpenRate}%
            </span>
          </div>
        )}
      </div>

      {/* Navigation Tabs Bar */}
      <div className="px-4 flex overflow-x-auto scrollbar-none items-center gap-1 bg-slate-950">
        {navItems.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative px-3.5 py-2.5 text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 border-b-2 ${
                isActive 
                  ? 'border-emerald-400 text-emerald-300 bg-emerald-950/20' 
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
                  tab.highlight 
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                    : 'bg-slate-800 text-slate-300'
                }`}>
                  {tab.badge}
                </span>
              )}
              {tab.mlBadge && (
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded font-extrabold bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                  {tab.mlBadge}
                </span>
              )}
              {tab.alertBadge && (
                <span className="text-[9px] font-mono px-1 py-0.2 rounded font-extrabold bg-rose-950 text-rose-300 border border-rose-600/40">
                  {tab.alertBadge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </header>
  );
};
