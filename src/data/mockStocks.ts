import { 
  StockData, 
  DailyBar, 
  TechnicalSignals, 
  BandarmologyData, 
  HistoricalSetupStats, 
  DecisionCategory,
  StrategySettings
} from '../types';
import { 
  calculateMedian, 
  calculatePercentile, 
  calculateConfidenceScore,
  computeOvernightEdgeScore,
  classifyDecision,
  generateStockAnalysisExplanation,
  DEFAULT_STRATEGY_SETTINGS
} from '../engine/analytics';
import {
  executionCostsFromSettings,
  netReturnAfterCosts,
  totalFrictionPct,
} from '../engine/executionPolicy';

// Raw metadata for 54 popular IDX tickers across sectors
interface RawTickerConfig {
  ticker: string;
  name: string;
  sector: string;
  basePrice: number;
  avgVolume: number;
  qualityProfile: 'ELITE' | 'PRIME' | 'STEADY' | 'VOLATILE' | 'EXTENDED' | 'ILLIQUID' | 'DISTRIBUTION';
  todayReturnPct: number;
  todayRelVol: number;
  closePos: number; // 0-1
}

const RAW_TICKERS: RawTickerConfig[] = [
  // Top Tier Bank & Blue Chips
  { ticker: 'BBCA', name: 'Bank Central Asia Tbk', sector: 'Financials', basePrice: 10450, avgVolume: 85000000, qualityProfile: 'ELITE', todayReturnPct: 1.45, todayRelVol: 1.75, closePos: 0.94 },
  { ticker: 'BBRI', name: 'Bank Rakyat Indonesia Tbk', sector: 'Financials', basePrice: 5125, avgVolume: 160000000, qualityProfile: 'PRIME', todayReturnPct: 1.25, todayRelVol: 1.45, closePos: 0.88 },
  { ticker: 'BMRI', name: 'Bank Mandiri Tbk', sector: 'Financials', basePrice: 6950, avgVolume: 95000000, qualityProfile: 'ELITE', todayReturnPct: 1.85, todayRelVol: 1.95, closePos: 0.96 },
  { ticker: 'BBNI', name: 'Bank Negara Indonesia Tbk', sector: 'Financials', basePrice: 5500, avgVolume: 42000000, qualityProfile: 'STEADY', todayReturnPct: 0.90, todayRelVol: 1.20, closePos: 0.82 },
  { ticker: 'BRIS', name: 'Bank Syariah Indonesia Tbk', sector: 'Financials', basePrice: 3120, avgVolume: 55000000, qualityProfile: 'ELITE', todayReturnPct: 2.30, todayRelVol: 2.10, closePos: 0.95 },
  { ticker: 'BBTN', name: 'Bank Tabungan Negara Tbk', sector: 'Financials', basePrice: 1390, avgVolume: 35000000, qualityProfile: 'STEADY', todayReturnPct: 0.72, todayRelVol: 1.10, closePos: 0.75 },
  { ticker: 'ARTO', name: 'Bank Jago Tbk', sector: 'Financials', basePrice: 2420, avgVolume: 28000000, qualityProfile: 'VOLATILE', todayReturnPct: 3.80, todayRelVol: 1.60, closePos: 0.85 },
  { ticker: 'BTPS', name: 'Bank BTPN Syariah Tbk', sector: 'Financials', basePrice: 1180, avgVolume: 14000000, qualityProfile: 'STEADY', todayReturnPct: -0.42, todayRelVol: 0.85, closePos: 0.40 },
  
  // Mining, Metals & Energy
  { ticker: 'ANTM', name: 'Aneka Tambang Tbk', sector: 'Basic Materials', basePrice: 1620, avgVolume: 88000000, qualityProfile: 'PRIME', todayReturnPct: 2.55, todayRelVol: 2.05, closePos: 0.92 },
  { ticker: 'MDKA', name: 'Merdeka Copper Gold Tbk', sector: 'Basic Materials', basePrice: 2450, avgVolume: 46000000, qualityProfile: 'PRIME', todayReturnPct: 1.65, todayRelVol: 1.55, closePos: 0.86 },
  { ticker: 'TINS', name: 'Timah Tbk', sector: 'Basic Materials', basePrice: 1340, avgVolume: 52000000, qualityProfile: 'ELITE', todayReturnPct: 3.10, todayRelVol: 2.35, closePos: 0.96 },
  { ticker: 'INCO', name: 'Vale Indonesia Tbk', sector: 'Basic Materials', basePrice: 3880, avgVolume: 18000000, qualityProfile: 'STEADY', todayReturnPct: 0.52, todayRelVol: 1.05, closePos: 0.70 },
  { ticker: 'MBMA', name: 'Merdeka Battery Materials Tbk', sector: 'Basic Materials', basePrice: 560, avgVolume: 65000000, qualityProfile: 'VOLATILE', todayReturnPct: -1.20, todayRelVol: 1.15, closePos: 0.35 },
  { ticker: 'NCKL', name: 'Trimegah Bangun Persada Tbk', sector: 'Basic Materials', basePrice: 910, avgVolume: 32000000, qualityProfile: 'STEADY', todayReturnPct: 1.10, todayRelVol: 1.25, closePos: 0.80 },
  { ticker: 'ADRO', name: 'Adaro Energy Indonesia Tbk', sector: 'Energy', basePrice: 3820, avgVolume: 74000000, qualityProfile: 'ELITE', todayReturnPct: 2.15, todayRelVol: 1.85, closePos: 0.93 },
  { ticker: 'PTBA', name: 'Bukit Asam Tbk', sector: 'Energy', basePrice: 2780, avgVolume: 38000000, qualityProfile: 'STEADY', todayReturnPct: 0.72, todayRelVol: 1.15, closePos: 0.78 },
  { ticker: 'PGAS', name: 'Perusahaan Gas Negara Tbk', sector: 'Energy', basePrice: 1565, avgVolume: 62000000, qualityProfile: 'PRIME', todayReturnPct: 1.95, todayRelVol: 1.65, closePos: 0.91 },
  { ticker: 'MEDC', name: 'Medco Energi Internasional Tbk', sector: 'Energy', basePrice: 1315, avgVolume: 49000000, qualityProfile: 'PRIME', todayReturnPct: 2.70, todayRelVol: 1.90, closePos: 0.89 },
  { ticker: 'ELSA', name: 'Elnusa Tbk', sector: 'Energy', basePrice: 485, avgVolume: 42000000, qualityProfile: 'STEADY', todayReturnPct: 1.04, todayRelVol: 1.30, closePos: 0.84 },
  { ticker: 'DOID', name: 'Delta Dunia Makmur Tbk', sector: 'Energy', basePrice: 650, avgVolume: 25000000, qualityProfile: 'STEADY', todayReturnPct: 1.55, todayRelVol: 1.20, closePos: 0.75 },
  { ticker: 'PGEO', name: 'Pertamina Geothermal Energy Tbk', sector: 'Utilities', basePrice: 1210, avgVolume: 39000000, qualityProfile: 'PRIME', todayReturnPct: 1.68, todayRelVol: 1.45, closePos: 0.87 },

  // Heavy Industry, Petrochem & Paper
  { ticker: 'ASII', name: 'Astra International Tbk', sector: 'Industrials', basePrice: 5175, avgVolume: 65000000, qualityProfile: 'ELITE', todayReturnPct: 1.47, todayRelVol: 1.60, closePos: 0.90 },
  { ticker: 'UNTR', name: 'United Tractors Tbk', sector: 'Industrials', basePrice: 27100, avgVolume: 6200000, qualityProfile: 'STEADY', todayReturnPct: 0.85, todayRelVol: 1.15, closePos: 0.81 },
  { ticker: 'INKP', name: 'Indah Kiat Pulp & Paper Tbk', sector: 'Basic Materials', basePrice: 8625, avgVolume: 12000000, qualityProfile: 'PRIME', todayReturnPct: 2.05, todayRelVol: 1.70, closePos: 0.92 },
  { ticker: 'TKIM', name: 'Pabrik Kertas Tjiwi Kimia Tbk', sector: 'Basic Materials', basePrice: 7200, avgVolume: 8500000, qualityProfile: 'STEADY', todayReturnPct: 1.40, todayRelVol: 1.20, closePos: 0.80 },
  { ticker: 'ESSA', name: 'Essa Industries Indonesia Tbk', sector: 'Basic Materials', basePrice: 920, avgVolume: 45000000, qualityProfile: 'PRIME', todayReturnPct: 3.35, todayRelVol: 2.20, closePos: 0.94 },
  { ticker: 'AKRA', name: 'AKR Corporindo Tbk', sector: 'Energy', basePrice: 1540, avgVolume: 22000000, qualityProfile: 'STEADY', todayReturnPct: 0.65, todayRelVol: 0.95, closePos: 0.72 },
  { ticker: 'SMGR', name: 'Semen Indonesia Tbk', sector: 'Basic Materials', basePrice: 3850, avgVolume: 19000000, qualityProfile: 'STEADY', todayReturnPct: 0.52, todayRelVol: 0.90, closePos: 0.65 },

  // Telecommunications & Technology
  { ticker: 'TLKM', name: 'Telkom Indonesia Tbk', sector: 'Telecommunication', basePrice: 3080, avgVolume: 110000000, qualityProfile: 'ELITE', todayReturnPct: 1.64, todayRelVol: 1.70, closePos: 0.92 },
  { ticker: 'ISAT', name: 'Indosat Ooredoo Hutchison Tbk', sector: 'Telecommunication', basePrice: 2360, avgVolume: 31000000, qualityProfile: 'STEADY', todayReturnPct: 0.85, todayRelVol: 1.10, closePos: 0.78 },
  { ticker: 'EXCL', name: 'XL Axiata Tbk', sector: 'Telecommunication', basePrice: 2240, avgVolume: 29000000, qualityProfile: 'STEADY', todayReturnPct: 1.35, todayRelVol: 1.30, closePos: 0.85 },
  { ticker: 'TOWR', name: 'Sarana Menara Nusantara Tbk', sector: 'Telecommunication', basePrice: 790, avgVolume: 35000000, qualityProfile: 'STEADY', todayReturnPct: -0.63, todayRelVol: 0.80, closePos: 0.45 },
  { ticker: 'TBIG', name: 'Tower Bersama Infrastructure Tbk', sector: 'Telecommunication', basePrice: 1780, avgVolume: 12000000, qualityProfile: 'STEADY', todayReturnPct: 0.28, todayRelVol: 0.75, closePos: 0.60 },
  { ticker: 'GOTO', name: 'GoTo Gojek Tokopedia Tbk', sector: 'Technology', basePrice: 72, avgVolume: 850000000, qualityProfile: 'VOLATILE', todayReturnPct: 2.85, todayRelVol: 1.90, closePos: 0.80 },

  // Consumer Non-Cyclical & Healthcare
  { ticker: 'ICBP', name: 'Indofood CBP Sukses Makmur Tbk', sector: 'Consumer Non-Cyclicals', basePrice: 12350, avgVolume: 9200000, qualityProfile: 'PRIME', todayReturnPct: 1.23, todayRelVol: 1.40, closePos: 0.88 },
  { ticker: 'INDF', name: 'Indofood Sukses Makmur Tbk', sector: 'Consumer Non-Cyclicals', basePrice: 7200, avgVolume: 15000000, qualityProfile: 'STEADY', todayReturnPct: 0.69, todayRelVol: 1.05, closePos: 0.76 },
  { ticker: 'MYOR', name: 'Mayora Indah Tbk', sector: 'Consumer Non-Cyclicals', basePrice: 2620, avgVolume: 11000000, qualityProfile: 'STEADY', todayReturnPct: 0.38, todayRelVol: 0.90, closePos: 0.65 },
  { ticker: 'CPIN', name: 'Charoen Pokphand Indonesia Tbk', sector: 'Consumer Non-Cyclicals', basePrice: 5125, avgVolume: 16000000, qualityProfile: 'STEADY', todayReturnPct: 1.48, todayRelVol: 1.25, closePos: 0.82 },
  { ticker: 'JPFA', name: 'Japfa Comfeed Indonesia Tbk', sector: 'Consumer Non-Cyclicals', basePrice: 1680, avgVolume: 21000000, qualityProfile: 'STEADY', todayReturnPct: 1.20, todayRelVol: 1.15, closePos: 0.79 },
  { ticker: 'KLBF', name: 'Kalbe Farma Tbk', sector: 'Healthcare', basePrice: 1690, avgVolume: 28000000, qualityProfile: 'STEADY', todayReturnPct: 0.89, todayRelVol: 1.10, closePos: 0.74 },
  { ticker: 'UNVR', name: 'Unilever Indonesia Tbk', sector: 'Consumer Non-Cyclicals', basePrice: 2280, avgVolume: 32000000, qualityProfile: 'DISTRIBUTION', todayReturnPct: -1.72, todayRelVol: 1.45, closePos: 0.20 },

  // Consumer Cyclical & Retail
  { ticker: 'ACES', name: 'Aspirasi Hidup Indonesia Tbk (ACES)', sector: 'Consumer Cyclicals', basePrice: 875, avgVolume: 42000000, qualityProfile: 'PRIME', todayReturnPct: 2.34, todayRelVol: 1.65, closePos: 0.90 },
  { ticker: 'MAPI', name: 'Mitra Adiperkasa Tbk', sector: 'Consumer Cyclicals', basePrice: 1620, avgVolume: 24000000, qualityProfile: 'STEADY', todayReturnPct: 0.62, todayRelVol: 1.05, closePos: 0.75 },
  { ticker: 'ERAA', name: 'Erajaya Swasembada Tbk', sector: 'Consumer Cyclicals', basePrice: 440, avgVolume: 38000000, qualityProfile: 'STEADY', todayReturnPct: 1.38, todayRelVol: 1.20, closePos: 0.80 },
  { ticker: 'AUTO', name: 'Astra Otoparts Tbk', sector: 'Consumer Cyclicals', basePrice: 2320, avgVolume: 12000000, qualityProfile: 'STEADY', todayReturnPct: 0.87, todayRelVol: 1.05, closePos: 0.75 },

  // Property & Real Estate
  { ticker: 'BSDE', name: 'Bumi Serpong Damai Tbk', sector: 'Real Estate', basePrice: 1190, avgVolume: 29000000, qualityProfile: 'PRIME', todayReturnPct: 1.71, todayRelVol: 1.50, closePos: 0.89 },
  { ticker: 'CTRA', name: 'Ciputra Development Tbk', sector: 'Real Estate', basePrice: 1310, avgVolume: 26000000, qualityProfile: 'PRIME', todayReturnPct: 1.55, todayRelVol: 1.40, closePos: 0.87 },
  { ticker: 'SMRA', name: 'Summarecon Agung Tbk', sector: 'Real Estate', basePrice: 650, avgVolume: 31000000, qualityProfile: 'STEADY', todayReturnPct: 1.56, todayRelVol: 1.25, closePos: 0.82 },
  { ticker: 'PWON', name: 'Pakuwon Jati Tbk', sector: 'Real Estate', basePrice: 472, avgVolume: 35000000, qualityProfile: 'STEADY', todayReturnPct: 0.85, todayRelVol: 1.00, closePos: 0.70 },

  // Conglomerates & Overextended / Volatile Stocks
  { ticker: 'BREN', name: 'Barito Renewables Energy Tbk', sector: 'Utilities', basePrice: 7150, avgVolume: 52000000, qualityProfile: 'EXTENDED', todayReturnPct: 6.80, todayRelVol: 2.80, closePos: 0.98 },
  { ticker: 'AMMN', name: 'Amman Mineral Internasional Tbk', sector: 'Basic Materials', basePrice: 9450, avgVolume: 48000000, qualityProfile: 'EXTENDED', todayReturnPct: 5.20, todayRelVol: 2.40, closePos: 0.95 },
  { ticker: 'SRTG', name: 'Saratoga Investama Sedaya Tbk', sector: 'Financials', basePrice: 2360, avgVolume: 15000000, qualityProfile: 'STEADY', todayReturnPct: 0.42, todayRelVol: 0.90, closePos: 0.60 },

  // Illiquid / Speculative / Low-turnover IDX Examples
  { ticker: 'BSJP', name: 'Bank Pembangunan Daerah Jabar Banten', sector: 'Financials', basePrice: 380, avgVolume: 350000, qualityProfile: 'ILLIQUID', todayReturnPct: 0.00, todayRelVol: 0.40, closePos: 0.50 },
  { ticker: 'BUFF', name: 'Buffalo Mandiri Pratama Tbk', sector: 'Basic Materials', basePrice: 145, avgVolume: 850000, qualityProfile: 'ILLIQUID', todayReturnPct: 4.30, todayRelVol: 0.60, closePos: 0.65 },
];

// Helper to generate deterministic pseudo-random sequence for reproducible mock data
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

// Generate 90 days of historical OHLC bars with nextOpen gaps for each ticker
function generateHistoricalBars(cfg: RawTickerConfig, tickerIndex: number): DailyBar[] {
  const bars: DailyBar[] = [];
  const days = 90;
  let currentPrice = cfg.basePrice * (cfg.qualityProfile === 'EXTENDED' ? 0.75 : 0.92);
  const now = new Date('2026-09-08T15:45:00+07:00');

  for (let i = days; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    // skip weekends
    if (d.getDay() === 0 || d.getDay() === 6) continue;

    const seed = tickerIndex * 1000 + i;
    const rnd1 = pseudoRandom(seed);
    const rnd2 = pseudoRandom(seed + 1);
    const rnd3 = pseudoRandom(seed + 2);
    const rnd4 = pseudoRandom(seed + 3);

    // Profile bias
    let trendBias = 0.0008;
    let volFactor = 1.0;
    if (cfg.qualityProfile === 'ELITE' || cfg.qualityProfile === 'PRIME') {
      trendBias = 0.0018;
      volFactor = 0.85; // lower tail risk
    } else if (cfg.qualityProfile === 'DISTRIBUTION') {
      trendBias = -0.0022;
      volFactor = 1.25;
    } else if (cfg.qualityProfile === 'EXTENDED') {
      trendBias = 0.0040;
      volFactor = 1.6;
    }

    const dayChangePct = (rnd1 - 0.48) * 0.035 * volFactor + trendBias;
    const openPrice = Math.round(currentPrice);
    let closePrice = Math.round(openPrice * (1 + dayChangePct));
    if (closePrice <= 50) closePrice = 50;

    const highPrice = Math.round(Math.max(openPrice, closePrice) * (1 + rnd2 * 0.015 * volFactor));
    const lowPrice = Math.round(Math.min(openPrice, closePrice) * (1 - rnd3 * 0.012 * volFactor));

    const dayVol = Math.round(cfg.avgVolume * (0.6 + rnd4 * 0.8));
    const turnover = Math.round(dayVol * ((highPrice + lowPrice) / 2));

    const dateStr = d.toISOString().split('T')[0];

    bars.push({
      date: dateStr,
      open: openPrice,
      high: highPrice,
      low: lowPrice,
      close: closePrice,
      volume: dayVol,
      turnover,
    });

    currentPrice = closePrice;
  }

  // Populate nextOpen for bars (overnight gap is nextOpen / close - 1)
  for (let j = 0; j < bars.length - 1; j++) {
    const bar = bars[j];
    const nextBar = bars[j + 1];

    // Generate realistic overnight gap based on ticker profile
    const seed = tickerIndex * 2000 + j;
    const rGap = pseudoRandom(seed);
    let gapPct = 0;

    if (cfg.qualityProfile === 'ELITE') {
      // High green open rate (~70%), rare bad gap
      if (rGap < 0.70) {
        gapPct = 0.002 + pseudoRandom(seed + 1) * 0.012; // +0.2% to +1.4%
      } else if (rGap < 0.93) {
        gapPct = -0.001 - pseudoRandom(seed + 2) * 0.006; // -0.1% to -0.7%
      } else {
        gapPct = -0.008 - pseudoRandom(seed + 3) * 0.007; // -0.8% to -1.5%
      }
    } else if (cfg.qualityProfile === 'PRIME') {
      // Good green open rate (~64%), low bad gap
      if (rGap < 0.64) {
        gapPct = 0.002 + pseudoRandom(seed + 1) * 0.014;
      } else if (rGap < 0.88) {
        gapPct = -0.002 - pseudoRandom(seed + 2) * 0.007;
      } else {
        gapPct = -0.010 - pseudoRandom(seed + 3) * 0.009;
      }
    } else if (cfg.qualityProfile === 'EXTENDED' || cfg.qualityProfile === 'VOLATILE') {
      // High return but high bad gap / tail risk!
      if (rGap < 0.54) {
        gapPct = 0.008 + pseudoRandom(seed + 1) * 0.035; // +0.8% to +4.3%
      } else if (rGap < 0.76) {
        gapPct = -0.005 - pseudoRandom(seed + 2) * 0.012;
      } else {
        gapPct = -0.020 - pseudoRandom(seed + 3) * 0.030; // Severe gap -2.0% to -5.0%!
      }
    } else if (cfg.qualityProfile === 'DISTRIBUTION') {
      // Bad green open rate (~42%), frequent bad gaps
      if (rGap < 0.42) {
        gapPct = 0.001 + pseudoRandom(seed + 1) * 0.008;
      } else {
        gapPct = -0.004 - pseudoRandom(seed + 2) * 0.018; // -0.4% to -2.2%
      }
    } else {
      // STEADY / ILLIQUID
      if (rGap < 0.55) {
        gapPct = 0.001 + pseudoRandom(seed + 1) * 0.009;
      } else {
        gapPct = -0.002 - pseudoRandom(seed + 2) * 0.011;
      }
    }

    const calculatedNextOpen = Math.round(bar.close * (1 + gapPct));
    bar.nextOpen = calculatedNextOpen;
    nextBar.open = calculatedNextOpen;
    // Maintain OHLC validity: High >= max(Open, Close) and Low <= min(Open, Close)
    nextBar.high = Math.max(nextBar.high, nextBar.open, nextBar.close);
    nextBar.low = Math.min(nextBar.low, nextBar.open, nextBar.close);
  }

  // Enforce today's live closing candle accurately
  const lastBar = bars[bars.length - 1];
  const prevBar = bars[bars.length - 2];
  if (lastBar && prevBar) {
    const todayChange = Math.round(prevBar.close * (cfg.todayReturnPct / 100));
    lastBar.close = prevBar.close + todayChange;
    const range = Math.max(10, Math.round(lastBar.close * 0.022));
    lastBar.low = Math.min(lastBar.close, prevBar.close) - Math.round(range * (1 - cfg.closePos));
    lastBar.high = Math.max(lastBar.close, prevBar.close) + Math.round(range * cfg.closePos);
    // Ensure open is also bounded within [low, high]
    lastBar.open = Math.min(lastBar.high, Math.max(lastBar.low, lastBar.open));
    lastBar.high = Math.max(lastBar.high, lastBar.open, lastBar.close);
    lastBar.low = Math.min(lastBar.low, lastBar.open, lastBar.close);
    lastBar.volume = Math.round(cfg.avgVolume * cfg.todayRelVol);
    lastBar.turnover = Math.round(lastBar.volume * lastBar.close);
  }

  return bars;
}

// Compute Technical Signals
function computeTechnical(bars: DailyBar[], cfg: RawTickerConfig): TechnicalSignals {
  const closes = bars.map(b => b.close);
  const n = closes.length;
  const currentClose = closes[n - 1] || cfg.basePrice;
  const lastBar = bars[bars.length - 1];

  const calcMA = (len: number): number => {
    if (n < len) return currentClose;
    const slice = closes.slice(n - len);
    return Math.round(slice.reduce((a, b) => a + b, 0) / len);
  };

  const ma5 = calcMA(5);
  const ma10 = calcMA(10);
  const ma20 = calcMA(20);
  const ma50 = calcMA(50);

  // RSI 14
  let gains = 0;
  let losses = 0;
  for (let i = Math.max(1, n - 14); i < n; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }
  const avgGain = gains / 14;
  const avgLoss = losses / 14;
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const rsi14 = Math.round((100 - (100 / (1 + rs))) * 10) / 10;

  // True Exponential Moving Average (EMA) and authentic MACD (12, 26, 9)
  const calcEMA = (len: number, series: number[] = closes): number[] => {
    if (series.length === 0) return [];
    const k = 2 / (len + 1);
    const emaValues: number[] = [series[0]];
    for (let i = 1; i < series.length; i++) {
      emaValues.push(series[i] * k + emaValues[i - 1] * (1 - k));
    }
    return emaValues;
  };

  const ema12Series = calcEMA(12);
  const ema26Series = calcEMA(26);
  const macdSeries: number[] = [];
  for (let i = 0; i < n; i++) {
    macdSeries.push((ema12Series[i] ?? currentClose) - (ema26Series[i] ?? currentClose));
  }
  const signalSeries = calcEMA(9, macdSeries);

  const macd = Math.round((macdSeries[n - 1] ?? 0) * 10) / 10;
  const macdSignal = Math.round((signalSeries[n - 1] ?? 0) * 10) / 10;
  const macdHist = Math.round((macd - macdSignal) * 10) / 10;

  // Real golden cross: previous MACD <= Signal and current MACD > Signal
  const prevMacd = macdSeries[n - 2] ?? macd;
  const prevSignal = signalSeries[n - 2] ?? macdSignal;
  const macdGoldenCross = prevMacd <= prevSignal && macd > macdSignal;

  // Momentum
  const momentum5d = n >= 6 ? Math.round(((currentClose / closes[n - 6]) - 1) * 1000) / 10 : cfg.todayReturnPct;
  const momentum10d = n >= 11 ? Math.round(((currentClose / closes[n - 11]) - 1) * 1000) / 10 : cfg.todayReturnPct * 1.5;

  // Relative Volume
  const recentVols = bars.slice(Math.max(0, n - 21), n - 1).map(b => b.volume);
  const avg20Vol = recentVols.length > 0 ? recentVols.reduce((a, b) => a + b, 0) / recentVols.length : cfg.avgVolume;
  const relativeVolume = Math.round((lastBar.volume / Math.max(1, avg20Vol)) * 100) / 100;

  // Volume Breakouts
  const vol5Max = Math.max(...bars.slice(Math.max(0, n - 6), n - 1).map(b => b.volume));
  const vol10Max = Math.max(...bars.slice(Math.max(0, n - 11), n - 1).map(b => b.volume));
  const vol20Max = Math.max(...recentVols);
  const volumeBreakout5d = lastBar.volume > vol5Max;
  const volumeBreakout10d = lastBar.volume > vol10Max;
  const volumeBreakout20d = lastBar.volume > vol20Max;

  // Close position in daily range
  const dailyRange = Math.max(1, lastBar.high - lastBar.low);
  const closePositionInRange = Math.min(1, Math.max(0, Math.round(((lastBar.close - lastBar.low) / dailyRange) * 100) / 100));
  const isNearDailyHigh = closePositionInRange >= 0.80;

  // Extended check: price > 1.12 * MA20 or RSI > 74
  const isExtended = currentClose > ma20 * 1.12 || rsi14 > 74 || cfg.qualityProfile === 'EXTENDED';

  // Candlestick shapes
  const bodySize = Math.abs(lastBar.close - lastBar.open);
  const isBullishCandle = lastBar.close > lastBar.open && closePositionInRange > 0.65;
  const isDoji = bodySize / dailyRange < 0.12;
  const isHammer = (lastBar.close - lastBar.low) > (2.0 * bodySize) && (lastBar.high - lastBar.close) < (0.3 * bodySize);

  // Bollinger Bands (20, 2)
  const stdDevSlice = closes.slice(Math.max(0, n - 20));
  const variance = stdDevSlice.reduce((sum, val) => sum + Math.pow(val - ma20, 2), 0) / stdDevSlice.length;
  const stdDev = Math.sqrt(variance);
  const bollingerUpper = Math.round(ma20 + 2 * stdDev);
  const bollingerLower = Math.round(ma20 - 2 * stdDev);
  const bollingerMiddle = ma20;
  const bollingerPosition = Math.round(((currentClose - bollingerLower) / Math.max(1, bollingerUpper - bollingerLower)) * 100);

  // Breakout 20D
  const maxClose20d = Math.max(...closes.slice(Math.max(0, n - 21), n - 1));
  const breakout20d = currentClose >= maxClose20d;

  // 50D High & Breakout
  const maxClose50d = Math.max(...closes.slice(Math.max(0, n - 51), n - 1));
  const breakout50d = currentClose >= maxClose50d;

  // 52-week High
  const high52w = Math.round(Math.max(...closes) * 1.05);
  const distFrom52wHigh = Math.round(((currentClose - high52w) / high52w) * 1000) / 10;

  // Trend Following: MA Stacking
  const maStackingBullish = ma5 > ma10 && ma10 > ma20 && ma20 > ma50;

  // ADX 14 simulation based on directional strength
  const momentumAbs = Math.abs(momentum10d);
  const rawAdx = 18 + Math.min(32, Math.round(momentumAbs * 2.2 + (relativeVolume > 1.4 ? 8 : 0)));
  const adx14 = Math.min(55, Math.max(14, rawAdx));

  // Pullback in Uptrend: Near MA20 with Bullish Reversal
  const distFromMa20Pct = Math.abs((currentClose - ma20) / ma20) * 100;
  const pullbackToMa20 = ma20 > ma50 && distFromMa20Pct <= 2.8 && (isBullishCandle || isHammer);

  // Ichimoku Kinko Hyo (9, 26, 52)
  const highs = bars.map(b => b.high);
  const lows = bars.map(b => b.low);
  const high9 = Math.max(...highs.slice(Math.max(0, n - 9)));
  const low9 = Math.min(...lows.slice(Math.max(0, n - 9)));
  const tenkanSen = Math.round((high9 + low9) / 2);

  const high26 = Math.max(...highs.slice(Math.max(0, n - 26)));
  const low26 = Math.min(...lows.slice(Math.max(0, n - 26)));
  const kijunSen = Math.round((high26 + low26) / 2);

  const high52 = Math.max(...highs.slice(Math.max(0, n - 52)));
  const low52 = Math.min(...lows.slice(Math.max(0, n - 52)));
  const senkouSpanB = Math.round((high52 + low52) / 2);
  const senkouSpanA = Math.round((tenkanSen + kijunSen) / 2);
  const chikouSpan = currentClose;

  const kumoCloudBreakout = currentClose > Math.max(senkouSpanA, senkouSpanB);
  const tenkanKijunCross = tenkanSen > kijunSen;

  // Intraday Morning Surge
  const intradayMorningSurge = relativeVolume >= 1.4 && currentClose > lastBar.open && closePositionInRange >= 0.70;
  const morningVolumeSurgeRatio = relativeVolume;

  return {
    ma5,
    ma10,
    ma20,
    ma50,
    rsi14,
    macd,
    macdSignal,
    macdHist,
    macdGoldenCross,
    momentum5d,
    momentum10d,
    relativeVolume,
    volumeBreakout5d,
    volumeBreakout10d,
    volumeBreakout20d,
    closePositionInRange,
    isNearDailyHigh,
    isExtended,
    isBullishCandle,
    isDoji,
    isHammer,
    bollingerUpper,
    bollingerLower,
    bollingerMiddle,
    bollingerPosition,
    breakout20d,
    atr14: Math.round(stdDev * 0.8),
    distFrom52wHigh,
    adx14,
    maStackingBullish,
    high50d: maxClose50d,
    breakout50d,
    pullbackToMa20,
    tenkanSen,
    kijunSen,
    senkouSpanA,
    senkouSpanB,
    chikouSpan,
    kumoCloudBreakout,
    tenkanKijunCross,
    intradayMorningSurge,
    morningVolumeSurgeRatio,
  };
}

// Compute Bandarmology / Broker Summary
function computeBandarmology(cfg: RawTickerConfig, tickerIndex: number): BandarmologyData {
  const seed = tickerIndex * 3000;
  const p = cfg.qualityProfile;

  let status: BandarmologyData['status'] = 'ACCUMULATION';
  let buyerConc = 62;
  let sellerConc = 41;
  let foreignFlow = 18500000000; // 18.5 B IDR
  let streak = 4;
  let score = 75;

  if (p === 'ELITE') {
    status = 'STRONG ACCUMULATION';
    buyerConc = 68 + Math.round(pseudoRandom(seed) * 12);
    sellerConc = 35 + Math.round(pseudoRandom(seed + 1) * 8);
    foreignFlow = Math.round((25 + pseudoRandom(seed + 2) * 50) * 1e9);
    streak = 5 + Math.round(pseudoRandom(seed + 3) * 4);
    score = 88;
  } else if (p === 'PRIME') {
    status = 'ACCUMULATION';
    buyerConc = 58 + Math.round(pseudoRandom(seed) * 10);
    sellerConc = 40 + Math.round(pseudoRandom(seed + 1) * 6);
    foreignFlow = Math.round((10 + pseudoRandom(seed + 2) * 20) * 1e9);
    streak = 3 + Math.round(pseudoRandom(seed + 3) * 3);
    score = 78;
  } else if (p === 'DISTRIBUTION') {
    status = 'STRONG DISTRIBUTION';
    buyerConc = 34 + Math.round(pseudoRandom(seed) * 6);
    sellerConc = 71 + Math.round(pseudoRandom(seed + 1) * 12);
    foreignFlow = Math.round((-15 - pseudoRandom(seed + 2) * 35) * 1e9);
    streak = 0;
    score = 22;
  } else if (p === 'EXTENDED' || p === 'VOLATILE') {
    status = pseudoRandom(seed) > 0.5 ? 'ACCUMULATION' : 'NEUTRAL';
    buyerConc = 52 + Math.round(pseudoRandom(seed + 1) * 10);
    sellerConc = 48 + Math.round(pseudoRandom(seed + 2) * 10);
    foreignFlow = Math.round((pseudoRandom(seed + 3) * 10 - 5) * 1e9);
    streak = 2;
    score = 58;
  } else {
    // STEADY / ILLIQUID
    status = 'NEUTRAL';
    buyerConc = 45 + Math.round(pseudoRandom(seed) * 8);
    sellerConc = 43 + Math.round(pseudoRandom(seed + 1) * 8);
    foreignFlow = Math.round((pseudoRandom(seed + 2) * 4 - 2) * 1e9);
    streak = 1;
    score = 50;
  }

  const brokerCodes = ['YU', 'CC', 'CS', 'PD', 'ZP', 'RX', 'BK', 'AK', 'GR', 'NI', 'XC', 'DX', 'SQ', 'DR', 'LG', 'OD'];
  const topBuyers = [
    { brokerCode: brokerCodes[(tickerIndex * 2) % brokerCodes.length], brokerName: 'CGS International', type: 'BUYER' as const, lot: Math.round(cfg.avgVolume / 100 * 0.28), avgPrice: cfg.basePrice, value: Math.round(cfg.avgVolume * cfg.basePrice * 0.28), percentage: Math.round(buyerConc * 0.45) },
    { brokerCode: brokerCodes[(tickerIndex * 2 + 1) % brokerCodes.length], brokerName: 'Mandiri Sekuritas', type: 'BUYER' as const, lot: Math.round(cfg.avgVolume / 100 * 0.22), avgPrice: cfg.basePrice, value: Math.round(cfg.avgVolume * cfg.basePrice * 0.22), percentage: Math.round(buyerConc * 0.35) },
    { brokerCode: brokerCodes[(tickerIndex * 2 + 2) % brokerCodes.length], brokerName: 'CLSA Sekuritas', type: 'BUYER' as const, lot: Math.round(cfg.avgVolume / 100 * 0.14), avgPrice: cfg.basePrice, value: Math.round(cfg.avgVolume * cfg.basePrice * 0.14), percentage: Math.round(buyerConc * 0.20) },
  ];

  const topSellers = [
    { brokerCode: brokerCodes[(tickerIndex * 3 + 3) % brokerCodes.length], brokerName: 'Maybank Sekuritas', type: 'SELLER' as const, lot: Math.round(cfg.avgVolume / 100 * 0.18), avgPrice: cfg.basePrice, value: Math.round(cfg.avgVolume * cfg.basePrice * 0.18), percentage: Math.round(sellerConc * 0.45) },
    { brokerCode: brokerCodes[(tickerIndex * 3 + 4) % brokerCodes.length], brokerName: 'Mirae Asset Sekuritas', type: 'SELLER' as const, lot: Math.round(cfg.avgVolume / 100 * 0.15), avgPrice: cfg.basePrice, value: Math.round(cfg.avgVolume * cfg.basePrice * 0.15), percentage: Math.round(sellerConc * 0.35) },
    { brokerCode: brokerCodes[(tickerIndex * 3 + 5) % brokerCodes.length], brokerName: 'Indo Premier Sekuritas', type: 'SELLER' as const, lot: Math.round(cfg.avgVolume / 100 * 0.10), avgPrice: cfg.basePrice, value: Math.round(cfg.avgVolume * cfg.basePrice * 0.10), percentage: Math.round(sellerConc * 0.20) },
  ];

  return {
    status,
    score,
    top3BuyerConcentration: buyerConc,
    top3SellerConcentration: sellerConc,
    brokerConcentrationDiff: buyerConc - sellerConc,
    netForeignFlow: foreignFlow,
    accumulationStreakDays: streak,
    largeTxPercentage: Math.round(35 + pseudoRandom(seed + 4) * 35),
    volumePriceDivergence: false,
    topBuyers,
    topSellers,
  };
}

// Compute Historical Setup Matching
function computeHistoricalSetupStats(
  bars: DailyBar[],
  tech: TechnicalSignals,
  cfg: RawTickerConfig
): HistoricalSetupStats {
  const matchedTrades: HistoricalSetupStats['matchedTrades'] = [];

  // Match bars that had similar conditions to today's 15:30-15:45 setup:
  // e.g., Close in top 35% of daily candle, or positive day return > 0.5%, or Rel Vol > 1.1
  for (let i = 0; i < bars.length - 1; i++) {
    const bar = bars[i];
    if (!bar.nextOpen) continue;

    const barRange = Math.max(1, bar.high - bar.low);
    const barPos = (bar.close - bar.low) / barRange;
    const barReturn = (bar.close - bar.open) / bar.open;

    // Condition matching
    const matchesClosePos = barPos >= 0.60;
    const matchesReturn = barReturn >= 0.003;
    const matchesSetup = (matchesClosePos && matchesReturn) || (barPos >= 0.75);

    if (matchesSetup) {
      const gapPct = Math.round(((bar.nextOpen - bar.close) / bar.close) * 1000) / 10;
      const nextHigh = bar.nextHigh || bar.nextOpen * 1.012;
      const recoveredIntraday = nextHigh > bar.close;

      matchedTrades.push({
        date: bar.date,
        entryClose: bar.close,
        nextOpen: bar.nextOpen,
        gapPct,
        dayReturnPct: Math.round(barReturn * 1000) / 10,
        relVolume: Math.round((bar.volume / cfg.avgVolume) * 10) / 10,
        recoveredIntraday,
      });
    }
  }

  // Ensure minimum matched sample size representation
  const count = matchedTrades.length;
  const gaps = matchedTrades.map(t => t.gapPct);

  const greenCount = gaps.filter(g => g > 0).length;
  const redCount = gaps.filter(g => g < 0).length;
  const flatCount = gaps.filter(g => g === 0).length;

  const greenOpenRate = count > 0 ? Math.round((greenCount / count) * 1000) / 10 : 50;
  const avgGap = gaps.length > 0 ? Math.round((gaps.reduce((a, b) => a + b, 0) / gaps.length) * 100) / 100 : 0;
  const medianGap = Math.round(calculateMedian(gaps) * 100) / 100;
  const p25Gap = Math.round(calculatePercentile(gaps, 25) * 100) / 100;
  const p75Gap = Math.round(calculatePercentile(gaps, 75) * 100) / 100;
  const worstGap = gaps.length > 0 ? Math.min(...gaps) : -1.5;
  const bestGap = gaps.length > 0 ? Math.max(...gaps) : 2.5;

  const badGaps = gaps.filter(g => g < -1.0);
  const severeGaps = gaps.filter(g => g < -2.0);
  const extremeGaps = gaps.filter(g => g < -3.0);
  const negativeGaps = gaps.filter(g => g < 0);

  const badGap1PctProb = count > 0 ? Math.round((badGaps.length / count) * 1000) / 10 : 10;
  const severeGap2PctProb = count > 0 ? Math.round((severeGaps.length / count) * 1000) / 10 : 4;
  const extremeGap3PctProb = count > 0 ? Math.round((extremeGaps.length / count) * 1000) / 10 : 1;

  const avgNegativeGap = negativeGaps.length > 0 
    ? Math.round((negativeGaps.reduce((a, b) => a + b, 0) / negativeGaps.length) * 100) / 100
    : -0.5;

  const recoveredCount = matchedTrades.filter(t => t.gapPct < 0 && t.recoveredIntraday).length;
  const gapDownRecoveryRate = negativeGaps.length > 0
    ? Math.round((recoveredCount / negativeGaps.length) * 1000) / 10
    : 45;

  const confidenceScore = calculateConfidenceScore(count, greenOpenRate, 20);

  return {
    comparableSetupsCount: count,
    greenOpenCount: greenCount,
    redOpenCount: redCount,
    flatOpenCount: flatCount,
    greenOpenRate,
    avgOvernightGap: avgGap,
    medianOvernightGap: medianGap,
    p25Gap,
    p75Gap,
    worstGap,
    bestGap,
    badGap1PctProb,
    severeGap2PctProb,
    extremeGap3PctProb,
    avgNegativeGap,
    gapDownRecoveryRate,
    confidenceScore,
    matchedTrades,
  };
}

// Check Stage 1 15:30 Pre-filter
function evaluatePrefilter(
  stock: {
    turnover: number;
    volume: number;
    technical: TechnicalSignals;
    changePct: number;
    price: number;
  },
  settings: StrategySettings
): { passed: boolean; score: number; failReasons: string[] } {
  const reasons: string[] = [];
  const { turnover, technical: tech, changePct, price } = stock;

  // Rule 1: Liquidity Filter (min daily turnover IDR 5 Milyar)
  if (turnover < settings.minDailyTurnoverIDR) {
    reasons.push(`Turnover rendah (< Rp ${(settings.minDailyTurnoverIDR / 1e9).toFixed(1)}B)`);
  }

  // Rule 2: Minimum Share Price (avoid sub-50 penny stock trap)
  if (price < 70) {
    reasons.push('Harga saham < Rp 70 (risiko likuiditas FCM IDX)');
  }

  // Rule 3: Extremely Extended Filter
  if (tech.isExtended && tech.rsi14 > 78) {
    reasons.push('Terlalu extended (RSI > 78 & jauh di atas MA20)');
  }

  // Rule 4: Abnormal Speculative Move (> +18% in single day)
  if (changePct > 18.0) {
    reasons.push('Kenaikan harian abnormal (> 18%, rentan profit taking pembukaan)');
  }

  // Rule 5: Weak Pre-close Volume
  if (tech.relativeVolume < 0.8) {
    reasons.push('Volume pre-closing lemah (Rel Vol < 0.8x)');
  }

  // Rule 6: Poor Price Structure (closed near day low)
  if (tech.closePositionInRange < 0.45) {
    reasons.push('Struktur harga buruk (Closing di paruh bawah rentang harian)');
  }

  const passed = reasons.length === 0;
  const score = Math.max(10, Math.round(100 - reasons.length * 25));

  return { passed, score, failReasons: reasons };
}

// Master generator for all 54 stocks
export function buildUniverse(settings: StrategySettings = DEFAULT_STRATEGY_SETTINGS): StockData[] {
  return RAW_TICKERS.map((cfg, idx) => {
    const historicalBars = generateHistoricalBars(cfg, idx);
    const lastBar = historicalBars[historicalBars.length - 1];
    const prevBar = historicalBars[historicalBars.length - 2] || lastBar;

    const price = lastBar.close;
    const change = price - prevBar.close;
    const changePct = Math.round(((price / prevBar.close) - 1) * 1000) / 10;
    const volume = lastBar.volume;
    const turnover = lastBar.turnover;

    const technical = computeTechnical(historicalBars, cfg);
    const bandarmology = computeBandarmology(cfg, idx);
    const historicalStats = computeHistoricalSetupStats(historicalBars, technical, cfg);

    // Evaluate prefilter
    const prefilter = evaluatePrefilter({ turnover, volume, technical, changePct, price }, settings);

    // Compute technical subscore
    let techScore = 50;
    if (technical.isNearDailyHigh) techScore += 18;
    if (technical.relativeVolume >= 1.4) techScore += 14;
    if (technical.macdGoldenCross) techScore += 10;
    if (technical.ma5 > technical.ma10) techScore += 8;
    if (technical.breakout20d) techScore += 10;
    if (technical.isExtended) techScore -= 20;
    techScore = Math.min(98, Math.max(15, techScore));

    // Canonical Risk/Execution transaction-friction policy
    const executionCosts = executionCostsFromSettings(settings);
    const totalFee = totalFrictionPct(executionCosts);
    const expectedGrossGap = historicalStats.avgOvernightGap;
    const expectedNetGap = Math.round(netReturnAfterCosts(expectedGrossGap, executionCosts) * 100) / 100;

    // Overnight Edge Score
    const { score: edgeScore, tailRiskScore } = computeOvernightEdgeScore(
      {
        historicalStats,
        technicalScore: techScore,
        bandarmologyScore: bandarmology.score,
        turnover,
        technical,
        expectedNetGap,
      },
      settings
    );

    // Classification
    const { decision, quality } = classifyDecision(
      edgeScore,
      tailRiskScore,
      historicalStats.badGap1PctProb,
      historicalStats.greenOpenRate,
      prefilter.passed,
      historicalStats.confidenceScore
    );

    const stockPartial: StockData = {
      ticker: cfg.ticker,
      name: cfg.name,
      sector: cfg.sector,
      price,
      change,
      changePct,
      volume,
      avgVolume: cfg.avgVolume,
      turnover,
      relativeVolume: technical.relativeVolume,
      high52w: Math.round(price * 1.15),
      low52w: Math.round(price * 0.72),
      historicalBars,
      technical,
      bandarmology,
      historicalStats,
      prefilterScore: prefilter.score,
      prefilterPassed: prefilter.passed,
      prefilterFailReasons: prefilter.failReasons,
      technicalScore: techScore,
      bandarmologyScore: bandarmology.score,
      tailRiskScore,
      expectedGrossGap,
      expectedNetGap,
      estimatedFee: Math.round(totalFee * 100) / 100,
      overnightEdgeScore: edgeScore,
      quality,
      decision,
      positiveFactors: [],
      riskFactors: [],
      aiConclusion: '',
    };

    // Generate AI Explanation
    const explanation = generateStockAnalysisExplanation(stockPartial);
    stockPartial.positiveFactors = explanation.positiveFactors;
    stockPartial.riskFactors = explanation.riskFactors;
    stockPartial.aiConclusion = explanation.aiConclusion;

    return stockPartial;
  });
}
