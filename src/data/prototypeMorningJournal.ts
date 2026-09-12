import { MorningPosition } from '../types';

/**
 * Explicit provenance for the seeded Morning Exit journal.
 *
 * These rows are demonstration fixtures only. They are not broker fills,
 * provider observations, or backtest evidence, and must never be promoted as
 * such when real provider integrations are introduced later.
 */
export const PROTOTYPE_MORNING_JOURNAL_PROVENANCE = Object.freeze({
  source: 'PROTOTYPE_SIMULATION' as const,
  label: 'Prototype / simulated journal',
  isLiveTradingEvidence: false,
  isBacktestEvidence: false,
});

/**
 * Seed-only presentation fixture. Application consumers receive defensive
 * copies so UI edits cannot mutate the canonical prototype catalog.
 */
export const PROTOTYPE_MORNING_POSITIONS: ReadonlyArray<Readonly<MorningPosition>> = Object.freeze([
  Object.freeze({ id:'pos-1', ticker:'BBCA', name:'Bank Central Asia Tbk', purchaseDate:'Yesterday 15:42 WIB', entryPrice:10300, lots:150, totalCostIDR:154500000, currentOpenPrice:10450, openGapPct:1.46, grossProfitIDR:2250000, netProfitIDR:1632000, netProfitPct:1.06, cutLossLevel:10150, takeProfitLevel:10450, exitStatus:'TAKE PROFIT', notes:'Green open gap confirmed. Selling into opening liquidity at 09:02 WIB.' }),
  Object.freeze({ id:'pos-2', ticker:'BRIS', name:'Bank Syariah Indonesia Tbk', purchaseDate:'Yesterday 15:44 WIB', entryPrice:3050, lots:300, totalCostIDR:91500000, currentOpenPrice:3120, openGapPct:2.30, grossProfitIDR:2100000, netProfitIDR:1734000, netProfitPct:1.90, cutLossLevel:3000, takeProfitLevel:3120, exitStatus:'TAKE PROFIT', notes:'Strong opening gap-up. Pre-close broker accumulation followed through.' }),
  Object.freeze({ id:'pos-3', ticker:'ASII', name:'Astra International Tbk', purchaseDate:'Yesterday 15:38 WIB', entryPrice:5125, lots:200, totalCostIDR:102500000, currentOpenPrice:5175, openGapPct:0.98, grossProfitIDR:1000000, netProfitIDR:588000, netProfitPct:0.57, cutLossLevel:5050, takeProfitLevel:5200, exitStatus:'FLAT / EXIT', notes:'Small positive gap. Executed early exit as planned.' }),
  Object.freeze({ id:'pos-4', ticker:'MBMA', name:'Merdeka Battery Materials Tbk', purchaseDate:'Yesterday 15:43 WIB', entryPrice:575, lots:1000, totalCostIDR:57500000, currentOpenPrice:565, openGapPct:-1.74, grossProfitIDR:-1000000, netProfitIDR:-1229000, netProfitPct:-2.14, cutLossLevel:568, takeProfitLevel:590, exitStatus:'CUT LOSS', notes:'NEGATIVE OPEN TRIGGERED: Exited immediately at 09:00:30 WIB per stop rule.' }),
  Object.freeze({ id:'pos-5', ticker:'ADRO', name:'Adaro Energy Indonesia Tbk', purchaseDate:'Yesterday 15:45 WIB', entryPrice:3740, lots:250, totalCostIDR:93500000, currentOpenPrice:3820, openGapPct:2.14, grossProfitIDR:2000000, netProfitIDR:1622000, netProfitPct:1.73, cutLossLevel:3690, takeProfitLevel:3820, exitStatus:'TAKE PROFIT', notes:'Energy sector gap-up. Target met at open.' }),
]);
