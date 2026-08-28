/**
 * Perfil del inversor recogido mediante el sistema de preguntas dinámico.
 * Ver lib/questions para la lógica de qué preguntas se hacen y cuándo.
 */

export type InvestmentObjective =
  | 'wealth_growth'
  | 'retirement'
  | 'income'
  | 'capital_preservation'
  | 'home_purchase'
  | 'financial_independence'
  | 'other';

export type HorizonBucket = 'short' | 'medium' | 'long';

export type RiskReaction =
  | 'sell_immediately'
  | 'sell_some'
  | 'do_nothing'
  | 'buy_more';

export type InvestorExperience = 'beginner' | 'intermediate' | 'experienced';

export type PreferredVehicle = 'etf' | 'stocks' | 'funds' | 'bonds' | 'no_preference';

export interface LiquidityNeed {
  /** ¿Podría necesitar retirar una parte relevante del capital? */
  mayNeedWithdrawal: boolean;
  /** Horizonte aproximado de esa posible retirada, si aplica. */
  timeframeYears?: number;
  /** Proporción aproximada de la cartera que podría necesitar liquidar (0-1). */
  approxShare?: number;
}

export interface ContributionPlan {
  makesRecurringContributions: boolean;
  /** Rango aproximado mensual/anual en divisa base — nunca cifra exacta obligatoria. */
  approxAmountBucket?: 'low' | 'medium' | 'high';
  frequency?: 'monthly' | 'quarterly' | 'annual' | 'irregular';
}

export interface InvestorPreferences {
  vehicles: PreferredVehicle[];
  esgFocus: boolean;
  exclusions: string[]; // p.ej. "tabaco", "armamento"
  sectorTilts: string[];
  countryTilts: string[];
  currencyPreference?: string;
  dividendFocus: boolean;
}

export interface InvestorProfile {
  objective: InvestmentObjective;
  objectiveOther?: string;

  horizonBucket: HorizonBucket;
  horizonYearsApprox: number;

  /** Pérdida máxima (en %) que el inversor dice poder tolerar en un mal año. */
  maxAcceptableLossPct: number;
  reactionToDrop: RiskReaction;
  experience: InvestorExperience;

  liquidity: LiquidityNeed;
  contributions: ContributionPlan;
  preferences: InvestorPreferences;

  /** Texto libre y opcional para cualquier circunstancia relevante no cubierta arriba. */
  situationNotes?: string;

  /** Marca de tiempo de cuándo se completó el cuestionario. */
  completedAt: string;
}
