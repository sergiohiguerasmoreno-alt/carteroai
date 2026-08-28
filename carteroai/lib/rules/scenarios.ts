import type { ReturnAnalysis, ScenarioRange } from '@/lib/types';

/**
 * Escenarios ilustrativos construidos ÚNICAMENTE a partir de la rentabilidad
 * y volatilidad histórica ya calculadas (nunca inventadas). Si no hay datos
 * suficientes, se devuelve una lista vacía en vez de fabricar un rango.
 */
export function buildScenarios(returns: ReturnAnalysis): ScenarioRange[] {
  const { annualizedReturnPct, annualizedVolatilityPct } = returns;
  if (annualizedReturnPct === undefined || annualizedVolatilityPct === undefined) return [];

  const r = annualizedReturnPct;
  const v = annualizedVolatilityPct;

  const assumptions = [
    `Calculado a partir de la rentabilidad anualizada (${r.toFixed(1)}%) y la volatilidad anualizada (${v.toFixed(1)}%) del periodo histórico con datos disponibles.`,
    'El escenario favorable y el adverso representan aproximadamente una desviación estándar por encima y por debajo de la media histórica, no un límite máximo o mínimo real.',
    'No es una predicción: los mercados pueden comportarse de forma muy distinta al pasado.',
  ];

  return [
    { name: 'favorable', annualizedReturnRangePct: [r, r + v], assumptions },
    { name: 'base', annualizedReturnRangePct: [r - v * 0.3, r + v * 0.3], assumptions },
    { name: 'adverse', annualizedReturnRangePct: [r - v, r], assumptions },
  ];
}
