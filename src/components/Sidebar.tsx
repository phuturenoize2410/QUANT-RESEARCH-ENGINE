import React from 'react';
import { 
  ShieldCheck, 
  Filter, 
  BarChart3, 
  Cpu, 
  Layers, 
  Trophy, 
  LineChart, 
  Globe2, 
  Users, 
  ShieldAlert, 
  Clock, 
  SlidersHorizontal, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  TrendingUp,
  Activity
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  shortlistCount: number;
  prefilterCount: number;
  onOpenSettings: () => void;
}

interface NavSection {
  title: string;
  items: {
    id: string;
    label: string;
    shortLabel: string;
    icon: React.ElementType;
    badge?: number | string;
    badgeType?: 'emerald' | 'cyan' | 'rose' | 'slate';
  }[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isCollapsed,
  onToggleCollapse,
  shortlistCount,
  prefilterCount,
  onOpenSettings,
}) => {
  const sections: NavSection[] = [
    {
      title: 'CORE DESK',
      items: [
        {
          id: 'shortlist',
          label: '15:45 Final Shortlist',
          shortLabel: 'Shortlist',
          icon: ShieldCheck,
          badge: shortlistCount,
          badgeType: 'emerald',
        },
        {
          id: 'screener',
          label: '15:30 Pre-Filter',
          shortLabel: 'Pre-Filter',
          icon: Filter,
          badge: prefilterCount,
          badgeType: 'slate',
        },
        {
          id: 'analysis',
          label: 'Single Stock Analysis',
          shortLabel: 'Analysis',
          icon: BarChart3,
        },
      ],
    },
    {
      title: 'QUANT RESEARCH',
      items: [
        {
          id: 'ml_lab',
          label: 'ML Lab & Adaptive AI',
          shortLabel: 'ML Lab',
          icon: Cpu,
          badge: 'ML',
          badgeType: 'cyan',
        },
        {
          id: 'quantlab',
          label: 'Quant Lab & Analogs',
          shortLabel: 'Quant Lab',
          icon: Layers,
        },
        {
          id: 'leaderboard',
          label: 'Strategy Leaderboard',
          shortLabel: 'Leaderboard',
          icon: Trophy,
        },
        {
          id: 'backtest',
          label: 'Overnight Backtest',
          shortLabel: 'Backtest',
          icon: LineChart,
        },
      ],
    },
    {
      title: 'MARKET INTELLIGENCE',
      items: [
        {
          id: 'opportunity_map',
          label: 'Opportunity Map',
          shortLabel: 'Opp Map',
          icon: Globe2,
        },
        {
          id: 'bandarmology',
          label: 'Broker Flow Matrix',
          shortLabel: 'Flows',
          icon: Users,
        },
        {
          id: 'gapdown',
          label: 'Gap-Down Risk Lab',
          shortLabel: 'Risk Lab',
          icon: ShieldAlert,
          badge: 'RISK',
          badgeType: 'rose',
        },
      ],
    },
    {
      title: 'PORTFOLIO & EXECUTION',
      items: [
        {
          id: 'morning_exit',
          label: 'Morning Exit Journal',
          shortLabel: 'Journal',
          icon: Clock,
        },
        {
          id: 'strategylab',
          label: 'Strategy Lab Studio',
          shortLabel: 'Strategy',
          icon: SlidersHorizontal,
        },
      ],
    },
  ];

  return (
    <aside
      className={`h-full bg-[#07101F] border-r border-[#22304A] flex flex-col justify-between transition-all duration-200 select-none z-30 shrink-0 ${
        isCollapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Top Sidebar Header */}
      <div>
        <div className="h-13 px-3 border-b border-[#22304A] flex items-center justify-between bg-[#0A1322]">
          {!isCollapsed ? (
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-7 h-7 rounded bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center shrink-0">
                <Activity className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="leading-tight truncate">
                <span className="font-bold text-slate-100 text-xs tracking-wider block">
                  OVERNIGHT EDGE
                </span>
                <span className="text-[10px] text-slate-400 block font-normal">
                  QUANT WORKSTATION
                </span>
              </div>
            </div>
          ) : (
            <div className="w-full flex justify-center">
              <div className="w-8 h-8 rounded bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center">
                <Activity className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
          )}

          {!isCollapsed && (
            <button
              onClick={onToggleCollapse}
              title="Collapse Sidebar"
              className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-[#101B2D] border border-transparent hover:border-[#22304A] transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Navigation Sections */}
        <div className="py-2 space-y-4 overflow-y-auto max-h-[calc(100vh-130px)] px-2">
          {sections.map((section, secIdx) => (
            <div key={secIdx} className="space-y-0.5">
              {!isCollapsed ? (
                <div className="px-2.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  {section.title}
                </div>
              ) : (
                <div className="my-1 border-t border-[#17243A]" />
              )}

              {section.items.map((item) => {
                const isActive = activeTab === item.id;
                const IconComponent = item.icon;

                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    title={isCollapsed ? item.label : undefined}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded text-xs font-medium transition group relative ${
                      isActive
                        ? 'bg-[#101B2D] text-emerald-300 border border-emerald-500/40 shadow-xs'
                        : 'text-slate-300 hover:text-slate-100 hover:bg-[#0D1727] border border-transparent'
                    } ${isCollapsed ? 'justify-center px-0' : ''}`}
                  >
                    <IconComponent
                      className={`w-4 h-4 shrink-0 transition ${
                        isActive
                          ? 'text-emerald-400'
                          : 'text-slate-400 group-hover:text-slate-200'
                      }`}
                    />

                    {!isCollapsed && (
                      <span className="truncate flex-1 text-left">
                        {item.label}
                      </span>
                    )}

                    {!isCollapsed && item.badge !== undefined && (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold leading-tight ${
                          item.badgeType === 'emerald'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                            : item.badgeType === 'cyan'
                            ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40'
                            : item.badgeType === 'rose'
                            ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                            : 'bg-[#1A263C] text-slate-300'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}

                    {/* Collapsed dot badge indicator */}
                    {isCollapsed && item.badge !== undefined && (
                      <span
                        className={`absolute top-1 right-1 w-2 h-2 rounded-full ${
                          item.badgeType === 'emerald'
                            ? 'bg-emerald-400'
                            : item.badgeType === 'cyan'
                            ? 'bg-cyan-400'
                            : item.badgeType === 'rose'
                            ? 'bg-rose-400'
                            : 'bg-slate-400'
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Footer Actions */}
      <div className="p-2 border-t border-[#22304A] bg-[#0A1322] space-y-1">
        <button
          onClick={onOpenSettings}
          title="Scoring Weights & Parameters"
          className={`w-full flex items-center gap-2 px-2.5 py-2 rounded text-xs font-medium text-slate-300 hover:text-slate-100 hover:bg-[#101B2D] border border-transparent hover:border-[#22304A] transition ${
            isCollapsed ? 'justify-center px-0' : ''
          }`}
        >
          <Settings className="w-4 h-4 text-cyan-400 shrink-0" />
          {!isCollapsed && <span className="truncate">Settings & Models</span>}
        </button>

        {isCollapsed && (
          <button
            onClick={onToggleCollapse}
            title="Expand Sidebar"
            className="w-full flex items-center justify-center p-2 rounded text-slate-400 hover:text-slate-100 hover:bg-[#101B2D] transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        {!isCollapsed && (
          <div className="px-2 pt-1 pb-0.5 text-[10px] text-slate-400 flex items-center justify-between border-t border-[#17243A]">
            <span>BUILD v2.4</span>
            <span className="text-emerald-500 font-mono">ONLINE</span>
          </div>
        )}
      </div>
    </aside>
  );
};
