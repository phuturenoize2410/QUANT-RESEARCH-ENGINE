import { FeatureContext, FeatureContextSource } from './featureContext';
import { ProviderMetadata } from './providerContracts';
import { TickerFeatureVector } from './ml/types';

export type FeatureProvenanceSource = FeatureContextSource | 'PRICE_HISTORY_DERIVED' | 'STOCK_SNAPSHOT' | 'UNKNOWN';
export interface FeatureProvenanceRecord { feature: keyof TickerFeatureVector; source: FeatureProvenanceSource; providerId?: string; asOfTimestamp: string; isSimulated: boolean; note?: string; }
export interface FeatureProvenanceSnapshot { ticker: string; records: FeatureProvenanceRecord[]; simulatedFeatureCount: number; unknownFeatureCount: number; productionSafe: boolean; }

const PRICE_HISTORY_FEATURES = new Set<keyof TickerFeatureVector>(['return1d','return3d','return5d','return10d','return20d','closePositionWithinRange','distanceFrom52wHighPct','ma5','ma10','ma20','ma50','ma200','isMaAligned','adx14','ichimokuSpanA','ichimokuSpanB','isAboveCloud','rsi14','macdLine','macdSignal','macdHist','macdHistExpansion','atr14','atrPct','bollingerBandwidth','volatilityCompressionRatio','avgVolume20','relativeVolume','volumeAcceleration','overnightPersistenceScore','historicalGreenOpenRate','avgOvernightGapPct','negativeGapRatePct','cvar95Overnight','openToHighPct','openToClosePct','morningRangePct','vwapRelation']);
const STOCK_SNAPSHOT_FEATURES = new Set<keyof TickerFeatureVector>(['ticker','timestamp','price','volume','turnoverIDR','spreadProxyPct','marketDepthRatio','liquidityScore','sector','brokerAccumulationScore','foreignNetFlowRatio']);
const MARKET_FEATURES = new Set<keyof TickerFeatureVector>(['ihsgRegime','marketBreadthPctAboveMa20','marketVolatilityIndex']);
const SECTOR_FEATURES = new Set<keyof TickerFeatureVector>(['sectorRelativeStrength','sectorMomentumRank']);
const FUNDAMENTAL_FEATURES = new Set<keyof TickerFeatureVector>(['revenueGrowthYoy','netMarginPct','roePct','pbvRatio','peRatio','fundamentalInflectionScore']);

function contextualRecord(feature: keyof TickerFeatureVector, source: FeatureContextSource, context: FeatureContext, provider: ProviderMetadata): FeatureProvenanceRecord {
  return { feature, source, providerId: source === 'MARKET_PROVIDER' ? provider.id : undefined, asOfTimestamp: context.asOfTimestamp, isSimulated: source === 'SIMULATED' || context.isSimulated };
}

/** Builds auditable feature lineage without coupling Feature Engine to an adapter implementation. */
export function buildFeatureProvenance(vector: TickerFeatureVector, context: FeatureContext, provider: ProviderMetadata): FeatureProvenanceSnapshot {
  const records = (Object.keys(vector) as (keyof TickerFeatureVector)[]).map(feature => {
    if (MARKET_FEATURES.has(feature)) return contextualRecord(feature, context.sources.market, context, provider);
    if (SECTOR_FEATURES.has(feature)) return contextualRecord(feature, context.sources.sector, context, provider);
    if (FUNDAMENTAL_FEATURES.has(feature)) return contextualRecord(feature, context.sources.fundamental, context, provider);
    if (PRICE_HISTORY_FEATURES.has(feature)) return { feature, source: 'PRICE_HISTORY_DERIVED' as const, providerId: provider.id, asOfTimestamp: context.asOfTimestamp, isSimulated: provider.mode === 'MOCK', note: 'Derived from point-in-time price/history inputs supplied by the market-data provider.' };
    if (STOCK_SNAPSHOT_FEATURES.has(feature)) {
      const brokerFeature = feature === 'brokerAccumulationScore' || feature === 'foreignNetFlowRatio';
      return { feature, source: brokerFeature ? context.sources.broker : 'STOCK_SNAPSHOT', providerId: brokerFeature && context.sources.broker !== 'MARKET_PROVIDER' ? undefined : provider.id, asOfTimestamp: context.asOfTimestamp, isSimulated: provider.mode === 'MOCK' || (brokerFeature && context.sources.broker === 'SIMULATED') } as FeatureProvenanceRecord;
    }
    return { feature, source: 'UNKNOWN' as const, asOfTimestamp: context.asOfTimestamp, isSimulated: true, note: 'Feature lineage has not been classified; production research must reject it.' };
  });
  const simulatedFeatureCount = records.filter(record => record.isSimulated).length;
  const unknownFeatureCount = records.filter(record => record.source === 'UNKNOWN').length;
  return { ticker: vector.ticker, records, simulatedFeatureCount, unknownFeatureCount, productionSafe: provider.mode !== 'MOCK' && simulatedFeatureCount === 0 && unknownFeatureCount === 0 };
}
