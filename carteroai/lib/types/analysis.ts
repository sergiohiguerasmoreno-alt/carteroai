import type { SourceRef } from './market';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface ScoreBreakdown {
  /** 0-100. Cada subpuntuación debe llevar su propia explicación textual. */
  overall: number;
  diversification: number;
  riskAlignment: number;
  cost: number;
  quality: number;
  suitability: number;
  explanation: string;
}

export interface AllocationSlice {
  label: string;
  valueBaseCcy: number;
  weightPct: number;
}

export interface CompositionAnalysis {
  byAsset: AllocationSlice[];
  bySector: AllocationSlice[];
  byGeography: AllocationSlice[];
  byCurrency: AllocationSlice[];
  byAssetClass: AllocationSlice[];
  /** Índice Herfindahl-Hirschman (0-1) de concentración por posición. */
  concentrationHhi: number;
  topPositionWeightPct: number;
  top5WeightPct: number;
  dataCompletenessPct: number; // % del valor de cartera con datos de sector/geografía disponibles
}

export interface OverlapPair {
  aName: string;
  bName: string;
  /** Solapamiento estimado (0-1) por peso conjunto en emisores comunes. */
  overlapScore: number;
  sharedTopHoldings: string[];
  basis: 'holdings_data' | 'unavailable';
}

export interface DiversificationAnalysis {
  effectiveNumberOfBets: number; // 1 / HHI
  overlapPairs: OverlapPair[];
  hiddenConcentrationNotes: string[];
  singleCountryExposurePct?: { country: string; pct: number };
  singleSectorExposurePct?: { sector: string; pct: number };
  summary: string;
}

export interface RiskMetric {
  label: string;
  value?: number;
  unit: string;
  confidence: ConfidenceLevel;
  explanation: string;
  available: boolean;
  unavailableReason?: string;
}

export interface RiskAnalysis {
  metrics: RiskMetric[]; // volatilidad, drawdown, riesgo divisa, etc.
  currencyExposure: AllocationSlice[];
  summary: string;
}

export interface BenchmarkChoice {
  name: string;
  rationale: string;
  symbol?: string;
}

export interface ReturnPoint {
  periodLabel: string;
  portfolioReturnPct?: number;
  benchmarkReturnPct?: number;
}

export interface ReturnAnalysis {
  benchmark: BenchmarkChoice;
  series: ReturnPoint[];
  annualizedReturnPct?: number;
  annualizedVolatilityPct?: number;
  sharpeApprox?: number;
  dataCoverageWarning?: string;
  disclaimer: string;
}

export type RecommendationCategory = 'maintain' | 'watch' | 'review' | 'change' | 'remove';

export interface Recommendation {
  id: string;
  category: RecommendationCategory;
  targetPositionIds: string[];
  targetLabel: string;
  /** Qué se cambiaría (vacío/"—" si category = maintain/watch). */
  whatToChange?: string;
  why: string;
  problemSolved?: string;
  riskReduced?: string;
  riskIncreased?: string;
  portfolioImpact: string;
  alternative?: string;
  evidence: string[]; // referencias a SourceRef.provider o a cálculos concretos
  taxOrCostConsiderations?: string;
  confidence: ConfidenceLevel;
  confidenceRationale: string;
}

export interface ScenarioRange {
  name: 'favorable' | 'base' | 'adverse';
  annualizedReturnRangePct: [number, number];
  assumptions: string[];
}

export interface FundamentalNote {
  positionId: string;
  label: string;
  summary: string;
  metricsUsed: string[];
  confidence: ConfidenceLevel;
}

export interface EtfNote {
  positionId: string;
  label: string;
  summary: string;
  redundantWith?: string[];
  confidence: ConfidenceLevel;
}

export interface ActionPlan {
  now: string[];
  next3Months: string[];
  next6to12Months: string[];
  rebalancing: {
    needed: boolean;
    rationale: string;
    thresholdNote: string;
  };
  noActionNeeded: boolean;
}

export interface PortfolioAnalysis {
  id: string;
  generatedAt: string;
  executiveSummary: {
    headline: string;
    doingWell: string[];
    problems: string[];
    mainRisks: string[];
    needsChanges: boolean;
    conservativeStatement?: string; // frase fija cuando needsChanges=false
  };
  score: ScoreBreakdown;
  composition: CompositionAnalysis;
  diversification: DiversificationAnalysis;
  risk: RiskAnalysis;
  returns: ReturnAnalysis;
  fundamentals: FundamentalNote[];
  etfNotes: EtfNote[];
  recommendations: Recommendation[];
  scenarios: ScenarioRange[];
  actionPlan: ActionPlan;
  sources: SourceRef[];
  dataLimitations: string[];
  disclaimer: string;
}
