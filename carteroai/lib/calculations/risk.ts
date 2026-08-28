import type { AllocationSlice, CompositionAnalysis, RiskAnalysis, RiskMetric } from '@/lib/types';
import type { PricePoint } from '@/lib/types';

const TRADING_DAYS = 252;
const MIN_POINTS_FOR_RISK = 40;

export function dailyReturns(points: PricePoint[]): number[] {
  const rets: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!.close;
    const curr = points[i]!.close;
    if (prev > 0) rets.push(curr / prev - 1);
  }
  return rets;
}

export function annualizedVolatility(returns: number[]): number | undefined {
  if (returns.length < MIN_POINTS_FOR_RISK) return undefined;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((acc, r) => acc + (r - mean) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(TRADING_DAYS);
}

export function maxDrawdown(points: PricePoint[]): number | undefined {
  if (points.length < MIN_POINTS_FOR_RISK) return undefined;
  let peak = points[0]!.close;
  let worst = 0;
  for (const p of points) {
    if (p.close > peak) peak = p.close;
    const dd = peak > 0 ? p.close / peak - 1 : 0;
    if (dd < worst) worst = dd;
  }
  return worst; // negativo, p.ej. -0.23
}

export function pearsonCorrelation(a: number[], b: number[]): number | undefined {
  const n = Math.min(a.length, b.length);
  if (n < MIN_POINTS_FOR_RISK) return undefined;
  const av = a.slice(-n);
  const bv = b.slice(-n);
  const meanA = av.reduce((x, y) => x + y, 0) / n;
  const meanB = bv.reduce((x, y) => x + y, 0) / n;
  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < n; i++) {
    const da = av[i]! - meanA;
    const db = bv[i]! - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }
  if (varA === 0 || varB === 0) return undefined;
  return cov / Math.sqrt(varA * varB);
}

export interface PositionRiskInput {
  positionId: string;
  weight: number;
  points?: PricePoint[];
}

function weightedAverage(items: { weight: number; value?: number }[]): { value?: number; coveredWeight: number } {
  let sum = 0;
  let coveredWeight = 0;
  for (const it of items) {
    if (it.value === undefined) continue;
    sum += it.value * it.weight;
    coveredWeight += it.weight;
  }
  if (coveredWeight === 0) return { value: undefined, coveredWeight: 0 };
  return { value: sum / coveredWeight, coveredWeight };
}

export function computeRiskAnalysis(
  composition: CompositionAnalysis,
  currencyExposure: AllocationSlice[],
  positionRisks: PositionRiskInput[],
): RiskAnalysis {
  const perPosition = positionRisks.map((pr) => {
    const rets = pr.points ? dailyReturns(pr.points) : [];
    return {
      weight: pr.weight,
      vol: pr.points ? annualizedVolatility(rets) : undefined,
      dd: pr.points ? maxDrawdown(pr.points) : undefined,
      hasHistory: !!pr.points && pr.points.length >= MIN_POINTS_FOR_RISK,
    };
  });

  const volAgg = weightedAverage(perPosition.map((p) => ({ weight: p.weight, value: p.vol })));
  const ddAgg = weightedAverage(perPosition.map((p) => ({ weight: p.weight, value: p.dd })));
  const coverage = perPosition.reduce((acc, p) => acc + (p.hasHistory ? p.weight : 0), 0);

  const metrics: RiskMetric[] = [];

  metrics.push({
    label: 'Volatilidad anualizada estimada',
    value: volAgg.value !== undefined ? volAgg.value * 100 : undefined,
    unit: '%',
    confidence: coverage >= 0.8 ? 'high' : coverage >= 0.4 ? 'medium' : 'low',
    available: volAgg.value !== undefined,
    unavailableReason: volAgg.value === undefined ? 'Histórico de precios insuficiente para calcular la volatilidad de forma fiable.' : undefined,
    explanation:
      volAgg.value !== undefined
        ? `Es una media ponderada de la volatilidad histórica de cada posición, cubriendo el ${(coverage * 100).toFixed(0)}% del valor de la cartera. Mide cuánto ha oscilado el valor de la cartera, no si esas oscilaciones son "buenas" o "malas".`
        : 'No hay suficiente histórico de precios disponible para las posiciones de la cartera.',
  });

  metrics.push({
    label: 'Caída máxima observada (drawdown)',
    value: ddAgg.value !== undefined ? ddAgg.value * 100 : undefined,
    unit: '%',
    confidence: coverage >= 0.8 ? 'high' : coverage >= 0.4 ? 'medium' : 'low',
    available: ddAgg.value !== undefined,
    unavailableReason: ddAgg.value === undefined ? 'Histórico de precios insuficiente para calcular el drawdown.' : undefined,
    explanation:
      ddAgg.value !== undefined
        ? 'Mayor caída desde un máximo hasta un mínimo posterior en el periodo de datos disponible (aproximación ponderada por posición, no la caída real simultánea de la cartera completa).'
        : 'No hay suficiente histórico de precios disponible.',
  });

  const topCurrency = currencyExposure[0];
  const fxExposurePct = currencyExposure.filter((c) => c.label !== topCurrency?.label).reduce((a, c) => a + c.weightPct, 0);
  metrics.push({
    label: 'Exposición a divisas distintas de la principal',
    value: fxExposurePct * 100,
    unit: '%',
    confidence: 'high',
    available: true,
    explanation: `El ${(fxExposurePct * 100).toFixed(0)}% de la cartera está denominado en divisas distintas de ${topCurrency?.label ?? 'la divisa base'}, lo que añade riesgo de tipo de cambio además del riesgo del activo subyacente.`,
  });

  metrics.push({
    label: 'Concentración (índice HHI)',
    value: composition.concentrationHhi,
    unit: '',
    confidence: 'high',
    available: true,
    explanation:
      'Índice entre 0 y 1 que resume cuánto pesan las mayores posiciones sobre el total. Valores más altos implican que unas pocas posiciones determinan la mayor parte del resultado de la cartera.',
  });

  const summary = `Cobertura de datos de riesgo: ${(coverage * 100).toFixed(0)}% del valor de la cartera cuenta con histórico de precios suficiente. ${
    coverage < 0.6 ? 'Interpreta las métricas de riesgo con cautela: una parte relevante de la cartera no tiene histórico fiable.' : ''
  }`.trim();

  return { metrics, currencyExposure, summary };
}
