import { nanoid } from 'nanoid';
import type { ActionPlan, Recommendation } from '@/lib/types';
import type { RecommendationDraft, RuleContext } from './types';
import { detectConcentration, detectCost, detectExclusionConflicts, detectOverlap, detectSuitabilityGap } from './detectors';

const NO_CHANGE_STATEMENT =
  'La cartera está bien construida para tus objetivos actuales y no recomendamos realizar cambios.';

function draftToRecommendation(draft: RecommendationDraft): Recommendation {
  return { id: nanoid(8), ...draft };
}

function buildMaintainRecommendations(ctx: RuleContext, flaggedIds: Set<string>): Recommendation[] {
  const maintained: Recommendation[] = [];
  for (const pc of ctx.positions) {
    if (flaggedIds.has(pc.position.id)) continue;
    maintained.push({
      id: nanoid(8),
      category: 'maintain',
      targetPositionIds: [pc.position.id],
      targetLabel: pc.position.name,
      why: 'No se ha identificado ningún problema que justifique un cambio: el peso, coste y encaje de esta posición son razonables para tu perfil con los datos disponibles.',
      portfolioImpact: 'Ninguno: se recomienda mantener la posición tal cual.',
      evidence: [`Peso en cartera: ${(pc.weightPct * 100).toFixed(1)}%.`],
      confidence: 'medium',
      confidenceRationale: 'Ausencia de señales de alerta en los análisis de concentración, solapamiento, coste y adecuación al perfil.',
    });
  }
  return maintained;
}

function buildActionPlan(recommendations: Recommendation[], needsChanges: boolean): ActionPlan {
  const changes = recommendations.filter((r) => r.category === 'change' || r.category === 'remove');
  const reviews = recommendations.filter((r) => r.category === 'review');
  const watches = recommendations.filter((r) => r.category === 'watch');

  if (!needsChanges) {
    return {
      now: [],
      next3Months: [],
      next6to12Months: [],
      rebalancing: {
        needed: false,
        rationale: 'No se ha detectado ninguna desviación relevante respecto a tu perfil que justifique un rebalanceo en este momento.',
        thresholdNote: 'Se considerará necesario un rebalanceo si el peso en activos de crecimiento se desvía más de 15-30 puntos porcentuales del rango orientativo para tu perfil, o si cambian tus objetivos, horizonte o tolerancia al riesgo.',
      },
      noActionNeeded: true,
    };
  }

  return {
    now: changes.map((r) => r.whatToChange ?? r.targetLabel),
    next3Months: reviews.map((r) => `Revisar: ${r.targetLabel} — ${r.why}`),
    next6to12Months: watches.map((r) => `Vigilar: ${r.targetLabel}`),
    rebalancing: {
      needed: changes.some((r) => r.targetPositionIds.length === 0),
      rationale: changes.some((r) => r.targetPositionIds.length === 0)
        ? 'El nivel global de riesgo de la cartera se desvía de forma relevante del rango orientativo para tu perfil.'
        : 'Los cambios identificados son puntuales y no requieren un rebalanceo global de la cartera.',
      thresholdNote: 'El rebalanceo se plantea solo ante desviaciones relevantes (>15 puntos porcentuales) respecto al rango orientativo de tu perfil, cambios fundamentales en un activo o cambios en tu situación — nunca por una simple oscilación de mercado a corto plazo.',
    },
    noActionNeeded: false,
  };
}

export interface RuleEngineResult {
  recommendations: Recommendation[];
  actionPlan: ActionPlan;
  needsChanges: boolean;
}

export function runDecisionEngine(ctx: RuleContext): RuleEngineResult {
  const drafts: RecommendationDraft[] = [
    ...detectConcentration(ctx),
    ...detectOverlap(ctx),
    ...detectCost(ctx),
    ...detectSuitabilityGap(ctx),
    ...detectExclusionConflicts(ctx),
  ];

  const recommendations = drafts.map(draftToRecommendation);

  const flaggedIds = new Set<string>();
  for (const r of recommendations) {
    for (const id of r.targetPositionIds) flaggedIds.add(id);
  }
  recommendations.push(...buildMaintainRecommendations(ctx, flaggedIds));

  const needsChanges = recommendations.some((r) => r.category === 'change' || r.category === 'remove');
  const actionPlan = buildActionPlan(recommendations, needsChanges);

  return { recommendations, actionPlan, needsChanges };
}

export { NO_CHANGE_STATEMENT };
