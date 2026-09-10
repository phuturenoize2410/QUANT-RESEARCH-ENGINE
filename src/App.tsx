import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopMarketBar } from './components/TopMarketBar';
import { StrategySettingsModal } from './components/StrategySettingsModal';
import { TodaysScreenerView } from './components/TodaysScreenerView';
import { FinalShortlistView } from './components/FinalShortlistView';
import { StockAnalysisView } from './components/StockAnalysisView';
import { OvernightBacktestView } from './components/OvernightBacktestView';
import { StrategyLabView } from './components/StrategyLabView';
import { BandarmologyView } from './components/BandarmologyView';
import { GapDownLabView } from './components/GapDownLabView';
import { MorningExitDashboardView } from './components/MorningExitDashboardView';
import { OpportunityMapView } from './components/OpportunityMapView';
import { StrategyLeaderboardView } from './components/StrategyLeaderboardView';
import { QuantLabView } from './components/QuantLabView';
import { MLLabView } from './components/MLLabView';
import { DEFAULT_STRATEGY_SETTINGS } from './engine/analytics';
import {
  buildManualMorningPosition,
  buildMorningPositionFromStock,
  ManualMorningPositionInput,
} from './engine/execution';
import {
  createPrototypeResearchPipeline,
  ResearchPipelineSnapshot,
} from './engine/researchPipeline';
import { StrategySettings, StockData, MorningPosition } from './types';

const INITIAL_MORNING_POSITIONS: MorningPosition[] = [
  { id:'pos-1', ticker:'BBCA', name:'Bank Central Asia Tbk', purchaseDate:'Yesterday 15:42 WIB', entryPrice:10300, lots:150, totalCostIDR:154500000, currentOpenPrice:10450, openGapPct:1.46, grossProfitIDR:2250000, netProfitIDR:1632000, netProfitPct:1.06, cutLossLevel:10150, takeProfitLevel:10450, exitStatus:'TAKE PROFIT', notes:'Green open gap confirmed. Selling into opening liquidity at 09:02 WIB.' },
  { id:'pos-2', ticker:'BRIS', name:'Bank Syariah Indonesia Tbk', purchaseDate:'Yesterday 15:44 WIB', entryPrice:3050, lots:300, totalCostIDR:91500000, currentOpenPrice:3120, openGapPct:2.30, grossProfitIDR:2100000, netProfitIDR:1734000, netProfitPct:1.90, cutLossLevel:3000, takeProfitLevel:3120, exitStatus:'TAKE PROFIT', notes:'Strong opening gap-up. Pre-close broker accumulation followed through.' },
  { id:'pos-3', ticker:'ASII', name:'Astra International Tbk', purchaseDate:'Yesterday 15:38 WIB', entryPrice:5125, lots:200, totalCostIDR:102500000, currentOpenPrice:5175, openGapPct:0.98, grossProfitIDR:1000000, netProfitIDR:588000, netProfitPct:0.57, cutLossLevel:5050, takeProfitLevel:5200, exitStatus:'FLAT / EXIT', notes:'Small positive gap. Executed early exit as planned.' },
  { id:'pos-4', ticker:'MBMA', name:'Merdeka Battery Materials Tbk', purchaseDate:'Yesterday 15:43 WIB', entryPrice:575, lots:1000, totalCostIDR:57500000, currentOpenPrice:565, openGapPct:-1.74, grossProfitIDR:-1000000, netProfitIDR:-1229000, netProfitPct:-2.14, cutLossLevel:568, takeProfitLevel:590, exitStatus:'CUT LOSS', notes:'NEGATIVE OPEN TRIGGERED: Exited immediately at 09:00:30 WIB per stop rule.' },
  { id:'pos-5', ticker:'ADRO', name:'Adaro Energy Indonesia Tbk', purchaseDate:'Yesterday 15:45 WIB', entryPrice:3740, lots:250, totalCostIDR:93500000, currentOpenPrice:3820, openGapPct:2.14, grossProfitIDR:2000000, netProfitIDR:1622000, netProfitPct:1.73, cutLossLevel:3690, takeProfitLevel:3820, exitStatus:'TAKE PROFIT', notes:'Energy sector gap-up. Target met at open.' },
];

export default function App() {
  const [strategySettings, setStrategySettings] = useState<StrategySettings>(DEFAULT_STRATEGY_SETTINGS);
  const [activeTab, setActiveTab] = useState<string>('shortlist');
  const [selectedTicker, setSelectedTicker] = useState<string>('BBCA');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [positions, setPositions] = useState<MorningPosition[]>(INITIAL_MORNING_POSITIONS);
  const [notification, setNotification] = useState<string | null>(null);
  const [researchSnapshot, setResearchSnapshot] = useState<ResearchPipelineSnapshot | null>(null);
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  const researchPipeline = useMemo(() => createPrototypeResearchPipeline(), []);

  useEffect(() => {
    let cancelled = false;
    setPipelineError(null);

    researchPipeline.refresh(strategySettings)
      .then(snapshot => {
        if (!cancelled) setResearchSnapshot(snapshot);
      })
      .catch(error => {
        if (!cancelled) {
          setPipelineError(error instanceof Error ? error.message : 'Research pipeline refresh failed.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [researchPipeline, strategySettings, refreshTrigger]);

  const universe = researchSnapshot?.universe ?? [];
  const selectedStock = useMemo(() => universe.find(s => s.ticker === selectedTicker) || universe[0], [universe, selectedTicker]);

  const handleSelectStock = useCallback((ticker: string) => { setSelectedTicker(ticker); setActiveTab('analysis'); }, []);
  const showNotification = (msg: string) => { setNotification(msg); setTimeout(() => setNotification(null), 4000); };
  const handleRefreshData = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
    const providerLabel = researchSnapshot
      ? `${researchSnapshot.provider.name} (${researchSnapshot.provider.mode})`
      : 'research pipeline';
    showNotification(`Refreshing ${providerLabel}. Prototype market data remains simulated.`);
  }, [researchSnapshot]);

  // UI delegates transaction assumptions, fees and simulated execution to the execution engine.
  const handleAddToJournal = useCallback((stock: StockData) => {
    const position = buildMorningPositionFromStock(stock, strategySettings, 100);
    setPositions(prev => [position, ...prev]);
    showNotification(`Logged ${stock.ticker} (${position.lots} lots) into Morning Exit Journal using centralized execution costs.`);
  }, [strategySettings]);

  const handleUpdatePosition = useCallback((id: string, updates: Partial<MorningPosition>) => setPositions(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p)), []);
  const handleRemovePosition = useCallback((id: string) => setPositions(prev => prev.filter(p => p.id !== id)), []);
  const handleAddManualPosition = useCallback((input: ManualMorningPositionInput) => {
    const stock = universe.find(candidate => candidate.ticker === input.ticker);
    const position = buildManualMorningPosition(input, stock, strategySettings);
    setPositions(prev => [{ ...position, id: `pos-${Date.now()}` }, ...prev]);
    showNotification(`Logged ${input.ticker} using centralized simulated execution and risk policy.`);
  }, [strategySettings, universe]);

  const shortlistCandidatesCount = researchSnapshot?.summary.shortlistCandidatesCount ?? 0;
  const prefilterPassedCount = researchSnapshot?.summary.prefilterPassedCount ?? 0;

  if (pipelineError) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#07101F] text-slate-100 p-6">
        <div className="max-w-xl rounded border border-red-500/40 bg-[#101B2D] p-5">
          <div className="text-sm font-semibold text-red-300">Research pipeline unavailable</div>
          <div className="mt-2 text-xs text-slate-300">{pipelineError}</div>
        </div>
      </div>
    );
  }

  if (!researchSnapshot) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#07101F] text-slate-100">
        <div className="text-xs text-slate-400">Loading provider → feature pipeline…</div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-[#07101F] text-slate-100 font-sans selection:bg-emerald-500 selection:text-slate-950">
      {notification && <div className="fixed bottom-4 right-4 z-50 bg-[#101B2D] border border-emerald-500/80 text-emerald-300 px-4 py-2.5 rounded shadow-2xl text-xs flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span><span className="font-medium">{notification}</span></div>}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} isCollapsed={isSidebarCollapsed} onToggleCollapse={() => setIsSidebarCollapsed(prev => !prev)} shortlistCount={shortlistCandidatesCount} prefilterCount={prefilterPassedCount} onOpenSettings={() => setIsSettingsOpen(true)} />
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <TopMarketBar universe={universe} selectedTicker={selectedTicker} onSelectStock={handleSelectStock} onRefreshData={handleRefreshData} onOpenSettings={() => setIsSettingsOpen(true)} onToggleSidebar={() => setIsSidebarCollapsed(prev => !prev)} activeTab={activeTab} setActiveTab={setActiveTab} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-[#0B1424] p-3 md:p-5">
          {activeTab === 'shortlist' && <FinalShortlistView universe={researchSnapshot.shortlistCandidates} onSelectStock={handleSelectStock} onAddToJournal={handleAddToJournal} onOpenSettings={() => setIsSettingsOpen(true)} />}
          {activeTab === 'ml_lab' && <MLLabView universe={universe} onSelectStock={handleSelectStock} onAddToJournal={handleAddToJournal} />}
          {activeTab === 'opportunity_map' && <OpportunityMapView universe={universe} onSelectStock={handleSelectStock} onAddToJournal={handleAddToJournal} />}
          {activeTab === 'leaderboard' && <StrategyLeaderboardView universe={universe} onSelectStock={handleSelectStock} onAddToJournal={handleAddToJournal} />}
          {activeTab === 'quantlab' && <QuantLabView universe={universe} onSelectStock={handleSelectStock} onAddToJournal={handleAddToJournal} />}
          {activeTab === 'screener' && <TodaysScreenerView universe={universe} onSelectStock={handleSelectStock} onNavigateToShortlist={() => setActiveTab('shortlist')} />}
          {activeTab === 'analysis' && selectedStock && <StockAnalysisView selectedStock={selectedStock} universe={universe} onSelectStock={setSelectedTicker} onAddToJournal={handleAddToJournal} />}
          {activeTab === 'gapdown' && <GapDownLabView universe={universe} onSelectStock={handleSelectStock} />}
          {activeTab === 'backtest' && <OvernightBacktestView universe={universe} settings={strategySettings} onUpdateSettings={setStrategySettings} onSelectStock={handleSelectStock} />}
          {activeTab === 'strategylab' && <StrategyLabView universe={universe} onSelectStock={handleSelectStock} />}
          {activeTab === 'bandarmology' && <BandarmologyView universe={universe} onSelectStock={handleSelectStock} />}
          {activeTab === 'morning_exit' && <MorningExitDashboardView positions={positions} onUpdatePosition={handleUpdatePosition} onRemovePosition={handleRemovePosition} onAddManualPosition={handleAddManualPosition} universe={universe} onSelectStock={handleSelectStock} />}
        </main>
      </div>
      <StrategySettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={strategySettings} onSave={(newSettings) => { setStrategySettings(newSettings); showNotification('Updated Strategy Scoring Weights and Execution Costs.'); }} />
    </div>
  );
}