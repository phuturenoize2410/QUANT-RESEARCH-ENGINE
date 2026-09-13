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
import {
  createPrototypeResearchApplicationService,
  ExecutionCostSettingKey,
  ManualMorningPositionInput,
  ResearchApplicationSnapshot,
  StrategyLabSortMetric,
} from './engine/researchApplication';
import { StrategySettings, StockData, MorningPosition } from './types';

export default function App() {
  const researchApplication = useMemo(() => createPrototypeResearchApplicationService(), []);
  const defaultStrategySettings = useMemo(
    () => researchApplication.getDefaultStrategySettings(),
    [researchApplication],
  );
  const morningJournalSeed = useMemo(
    () => researchApplication.getMorningJournalSeed(),
    [researchApplication],
  );

  const [strategySettings, setStrategySettings] = useState<StrategySettings>(() => defaultStrategySettings);
  const [activeTab, setActiveTab] = useState<string>('shortlist');
  const [selectedTicker, setSelectedTicker] = useState<string>('BBCA');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [positions, setPositions] = useState<MorningPosition[]>(() => morningJournalSeed.positions);
  const [notification, setNotification] = useState<string | null>(null);
  const [researchSnapshot, setResearchSnapshot] = useState<ResearchApplicationSnapshot | null>(null);
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPipelineError(null);

    researchApplication.refresh(strategySettings)
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
  }, [researchApplication, strategySettings, refreshTrigger]);

  const universe = researchSnapshot?.universe ?? [];
  const selectedStock = useMemo(() => universe.find(s => s.ticker === selectedTicker) || universe[0], [universe, selectedTicker]);
  const topShortlistEnsemble = useMemo(() => {
    const topCandidate = researchSnapshot?.shortlistCandidates[0];
    if (!researchSnapshot || !topCandidate) return null;
    return researchApplication.evaluateShortlistCandidate(
      topCandidate,
      researchSnapshot.featureContext,
    );
  }, [researchApplication, researchSnapshot]);
  const quantLabConditions = useMemo(
    () => researchApplication.getQuantLabConditions(),
    [researchApplication],
  );

  const handleEvaluateDecisionCandidate = useCallback((stock: StockData) => {
    if (!researchSnapshot) {
      throw new Error('Decision evaluation requires an active research snapshot.');
    }

    return researchApplication.evaluateDecisionCandidate(
      stock,
      researchSnapshot.featureContext,
    );
  }, [researchApplication, researchSnapshot]);

  const handleEvaluateQuantLabConditions = useCallback((stocks: StockData[], conditionIds: string[]) => (
    researchApplication.evaluateQuantLabConditions(stocks, conditionIds)
  ), [researchApplication]);

  const handleDiscoverQuantLabSetups = useCallback((stocks: StockData[]) => (
    researchApplication.discoverQuantLabSetups(stocks)
  ), [researchApplication]);

  const handleFindQuantLabAnalogs = useCallback((stock: StockData, stocks: StockData[], limit: number) => (
    researchApplication.findQuantLabAnalogs(stock, stocks, limit)
  ), [researchApplication]);

  const handleGetStrategyLabCatalog = useCallback((sortBy: StrategyLabSortMetric, category?: string) => (
    researchApplication.getStrategyLabCatalog(sortBy, category)
  ), [researchApplication]);

  const handleCalculateExecutionFriction = useCallback((settings: StrategySettings) => (
    researchApplication.calculateExecutionFrictionPct(settings)
  ), [researchApplication]);

  const handleApplyExecutionCostInput = useCallback((
    settings: StrategySettings,
    key: ExecutionCostSettingKey,
    rawValue: string,
  ) => researchApplication.applyExecutionCostInput(settings, key, rawValue), [researchApplication]);

  const handleSelectStock = useCallback((ticker: string) => { setSelectedTicker(ticker); setActiveTab('analysis'); }, []);
  const showNotification = (msg: string) => { setNotification(msg); setTimeout(() => setNotification(null), 4000); };
  const handleRefreshData = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
    const providerLabel = researchSnapshot
      ? `${researchSnapshot.provider.name} (${researchSnapshot.provider.mode})`
      : 'research pipeline';
    showNotification(`Refreshing ${providerLabel}. Prototype market data remains simulated.`);
  }, [researchSnapshot]);

  // React delegates execution intent to the application boundary; market-specific
  // execution assumptions and default position sizing are resolved downstream.
  const handleAddToJournal = useCallback((stock: StockData) => {
    const position = researchApplication.buildStrategyJournalPosition(stock, strategySettings);
    setPositions(prev => [position, ...prev]);
    showNotification(`Logged ${stock.ticker} (${position.lots} lots) into Morning Exit Journal using centralized execution costs.`);
  }, [researchApplication, strategySettings]);

  const handleUpdatePosition = useCallback((id: string, updates: Partial<MorningPosition>) => setPositions(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p)), []);
  const handleRemovePosition = useCallback((id: string) => setPositions(prev => prev.filter(p => p.id !== id)), []);
  const handleAddManualPosition = useCallback((input: ManualMorningPositionInput) => {
    const stock = universe.find(candidate => candidate.ticker === input.ticker);
    const position = researchApplication.buildManualJournalPosition(input, stock, strategySettings);
    setPositions(prev => [position, ...prev]);
    showNotification(`Logged ${input.ticker} using centralized simulated execution and risk policy.`);
  }, [researchApplication, strategySettings, universe]);

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
          {activeTab === 'shortlist' && <FinalShortlistView universe={researchSnapshot.shortlistCandidates} topEnsemble={topShortlistEnsemble} evaluateDecisionCandidate={handleEvaluateDecisionCandidate} onSelectStock={handleSelectStock} onAddToJournal={handleAddToJournal} onOpenSettings={() => setIsSettingsOpen(true)} />}
          {activeTab === 'ml_lab' && <MLLabView universe={universe} onSelectStock={handleSelectStock} onAddToJournal={handleAddToJournal} />}
          {activeTab === 'opportunity_map' && <OpportunityMapView universe={universe} onSelectStock={handleSelectStock} onAddToJournal={handleAddToJournal} />}
          {activeTab === 'leaderboard' && <StrategyLeaderboardView universe={universe} onSelectStock={handleSelectStock} onAddToJournal={handleAddToJournal} />}
          {activeTab === 'quantlab' && <QuantLabView universe={universe} conditionCatalog={quantLabConditions} evaluateConditionalProbability={handleEvaluateQuantLabConditions} runSetupDiscovery={handleDiscoverQuantLabSetups} findHistoricalAnalogs={handleFindQuantLabAnalogs} onSelectStock={handleSelectStock} onAddToJournal={handleAddToJournal} />}
          {activeTab === 'screener' && <TodaysScreenerView universe={universe} onSelectStock={handleSelectStock} onNavigateToShortlist={() => setActiveTab('shortlist')} />}
          {activeTab === 'analysis' && selectedStock && <StockAnalysisView selectedStock={selectedStock} universe={universe} onSelectStock={setSelectedTicker} onAddToJournal={handleAddToJournal} />}
          {activeTab === 'gapdown' && <GapDownLabView universe={universe} onSelectStock={handleSelectStock} />}
          {activeTab === 'backtest' && <OvernightBacktestView universe={universe} settings={strategySettings} onUpdateSettings={setStrategySettings} onSelectStock={handleSelectStock} />}
          {activeTab === 'strategylab' && <StrategyLabView universe={universe} getCatalog={handleGetStrategyLabCatalog} onSelectStock={handleSelectStock} />}
          {activeTab === 'bandarmology' && <BandarmologyView universe={universe} onSelectStock={handleSelectStock} />}
          {activeTab === 'morning_exit' && (
            <div className="space-y-3">
              <div className="rounded border border-amber-500/40 bg-amber-950/20 px-3 py-2 text-[11px] text-amber-200">
                {morningJournalSeed.provenance.label} — seeded rows are demonstration fixtures, not broker fills or backtest evidence. New journal entries remain simulated until a validated execution provider is introduced.
              </div>
              <MorningExitDashboardView positions={positions} onUpdatePosition={handleUpdatePosition} onRemovePosition={handleRemovePosition} onAddManualPosition={handleAddManualPosition} universe={universe} onSelectStock={handleSelectStock} />
            </div>
          )}
        </main>
      </div>
      <StrategySettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={strategySettings}
        defaultSettings={defaultStrategySettings}
        calculateExecutionFrictionPct={handleCalculateExecutionFriction}
        applyExecutionCostInput={handleApplyExecutionCostInput}
        onSave={(newSettings) => { setStrategySettings(newSettings); showNotification('Updated Strategy Scoring Weights and Execution Costs.'); }}
      />
    </div>
  );
}
