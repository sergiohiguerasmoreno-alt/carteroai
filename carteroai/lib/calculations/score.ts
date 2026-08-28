import type { CompositionAnalysis, DiversificationAnalysis, InvestorProfile, RiskAnalysis, ScoreBreakdown } from '@/lib/types';
import type { CostAnalysis } from './cost';
import { computeSuitability } from './suitability';

const WEIGHTS = {
  diversification: 0.2,
  riskAlignment: 0.2,
  cost: 0.15,
  quality: 0.15,
  suitability: 0.3,
};

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

function diversificationScore(composition: CompositionAnalysis, diversification: DiversificationAnalysis): { score: number; text: string } {
  const n = composition.byAsset.length || 1;
  const ratio = clamp((diversification.effectiveNumberOfBets / n) * 100);
  let score = ratio;
  const notes: string[] = [`número efectivo de posiciones ${diversification.effectiveNumberOfBets.toFixed(1)} sobre ${n} posiciones reales`];

  if (composition.topPositionWeightPct > 0.25) {
    score -= 20;
    notes.push(`la mayor posición concentra el ${(composition.topPositionWeightPct * 100).toFixed(0)}% de la cartera`);
  }
  if (composition.top5WeightPct > 0.7) {
    score -= 10;
    notes.push(`las 5 mayores posiciones suman el ${(composition.top5WeightPct * 100).toFixed(0)}%`);
  }
  const notableOverlaps = diversification.overlapPairs.filter((o) => o.basis === 'holdings_data' && o.overlapScore >= 0.3);
  if (notableOverlaps.length > 0) {
    score -= 10 * Math.min(notableOverlaps.length, 3);
    notes.push(`solapamiento relevante detectado entre ${notableOverlaps.length} par(es) de fondos/ETFs`);
  }

  return { score: clamp(score), text: `Diversificación: ${notes.join('; ')}.` };
}

function costScore(cost: CostAnalysis): { score: number; text: string } {
  if (cost.weightedTerPct === undefined) {
    return { score: 60, text: 'Coste: sin datos de TER suficientes para puntuar con precisión; se asigna una puntuación neutra.' };
  }
  const ter = cost.weightedTerPct * 100;
  let score: number;
  if (ter <= 0.25) score = 100;
  else if (ter <= 0.5) score = 85;
  else if (ter <= 0.75) score = 65;
  else if (ter <= 1.0) score = 45;
  else score = 25;
  return { score, text: `Coste: TER medio ponderado de ${ter.toFixed(2)}% sobre la parte de la cartera en ETFs/fondos.` };
}

function qualityScore(composition: CompositionAnalysis, risk: RiskAnalysis): { score: number; text: string } {
  const volMetric = risk.metrics.find((m) => m.label.startsWith('Volatilidad'));
  const riskCoverage = volMetric?.available ? 1 : 0.3;
  const score = clamp(composition.dataCompletenessPct * 60 + riskCoverage * 40);
  return {
    score,
    text: `Calidad de datos: ${(composition.dataCompletenessPct * 100).toFixed(0)}% de la cartera con clasificación sectorial/geográfica y ${volMetric?.available ? 'histórico de riesgo disponible' : 'histórico de riesgo limitado'}.`,
  };
}

export function computeScore(
  composition: CompositionAnalysis,
  diversification: DiversificationAnalysis,
  risk: RiskAnalysis,
  cost: CostAnalysis,
  profile: InvestorProfile,
): ScoreBreakdown {
  const div = diversificationScore(composition, diversification);
  const suit = computeSuitability(composition.byAssetClass, profile);
  const c = costScore(cost);
  const q = qualityScore(composition, risk);

  // "Adecuación al inversor" (suitability, sentido amplio): parte del ajuste
  // de riesgo y penaliza además desajustes de liquidez detectables.
  let suitabilityBroad = suit.score;
  const liquidityNotes: string[] = [];
  if (profile.liquidity.mayNeedWithdrawal && (profile.liquidity.timeframeYears ?? 99) <= 2 && suit.growthWeight > 0.5) {
    suitabilityBroad -= 15;
    liquidityNotes.push('posible necesidad de liquidez a corto plazo con alta exposición a activos volátiles');
  }
  suitabilityBroad = clamp(suitabilityBroad);

  const overall = clamp(
    div.score * WEIGHTS.diversification +
      suit.score * WEIGHTS.riskAlignment +
      c.score * WEIGHTS.cost +
      q.score * WEIGHTS.quality +
      suitabilityBroad * WEIGHTS.suitability,
  );

  const label = overall >= 85 ? 'Muy buena' : overall >= 70 ? 'Buena' : overall >= 55 ? 'Aceptable, con puntos a revisar' : overall >= 40 ? 'Mejorable' : 'Requiere atención';

  const explanation = [
    `${Math.round(overall)}/100 — ${label}.`,
    `Ponderación: diversificación ${WEIGHTS.diversification * 100}%, ajuste de riesgo ${WEIGHTS.riskAlignment * 100}%, coste ${WEIGHTS.cost * 100}%, calidad de datos ${WEIGHTS.quality * 100}%, adecuación al inversor ${WEIGHTS.suitability * 100}%.`,
    div.text,
    suit.explanation,
    c.text,
    q.text,
    liquidityNotes.length > 0 ? `Adecuación: ${liquidityNotes.join('; ')}.` : '',
    'La puntuación resume el análisis, no lo sustituye: la lectura completa está en cada sección del informe.',
  ]
    .filter(Boolean)
    .join(' ');

  return {
    overall: Math.round(overall),
    diversification: Math.round(div.score),
    riskAlignment: Math.round(suit.score),
    cost: Math.round(c.score),
    quality: Math.round(q.score),
    suitability: Math.round(suitabilityBroad),
    explanation,
  };
}
