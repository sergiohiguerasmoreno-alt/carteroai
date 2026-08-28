import type {
  CompositionAnalysis,
  DiversificationAnalysis,
  InvestorProfile,
  Position,
  RiskAnalysis,
} from '@/lib/types';
import type { CostAnalysis } from '@/lib/calculations/cost';
import type { SuitabilityResult } from '@/lib/calculations/suitability';

export interface PositionContext {
  position: Position;
  weightPct: number;
  terPct?: number;
}

export interface RuleContext {
  positions: PositionContext[];
  composition: CompositionAnalysis;
  diversification: DiversificationAnalysis;
  risk: RiskAnalysis;
  cost: CostAnalysis;
  suitability: SuitabilityResult;
  profile: InvestorProfile;
  baseCurrency: string;
}

export interface RecommendationDraft {
  category: 'watch' | 'review' | 'change' | 'remove';
  targetPositionIds: string[];
  targetLabel: string;
  whatToChange?: string;
  why: string;
  problemSolved?: string;
  riskReduced?: string;
  riskIncreased?: string;
  portfolioImpact: string;
  alternative?: string;
  evidence: string[];
  taxOrCostConsiderations?: string;
  confidence: 'high' | 'medium' | 'low';
  confidenceRationale: string;
}
