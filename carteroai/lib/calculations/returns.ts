import type { BenchmarkChoice, PricePoint, ReturnAnalysis, ReturnPoint } from '@/lib/types';
import { annualizedVolatility, dailyReturns } from './risk';

export interface WeightedHistory {
  positionId: string;
  weight: number;
  points?: PricePoint[]; // ya en la divisa nativa; se asume rentabilidad, no valor absoluto
}

/** Construye un índice ponderado (base 100) combinando series de varias posiciones en fechas comunes. */
function buildWeightedIndex(items: WeightedHistory[]): PricePoint[] {
  const withHistory = items.filter((i) => i.points && i.points.length > 1);
  if (withHistory.length === 0) return [];

  // Fechas comunes a todas las series consideradas (intersección), para evitar sesgos por huecos.
  const dateSets = withHistory.map((i) => new Set(i.points!.map((p) => p.date)));
  const commonDates = [...dateSets[0]!].filter((d) => dateSets.every((s) => s.has(d)));
  commonDates.sort();
  if (commonDates.length < 30) return [];

  const totalWeight = withHistory.reduce((a, b) => a + b.weight, 0);
  if (totalWeight === 0) return [];

  const series: PricePoint[] = [];
  let indexValue = 100;
  const pricesByPosition = withHistory.map((i) => {
    const m = new Map(i.points!.map((p) => [p.date, p.close]));
    return { weight: i.weight / totalWeight, prices: m };
  });

  for (let d = 1; d < commonDates.length; d++) {
    const prevDate = commonDates[d - 1]!;
    const currDate = commonDates[d]!;
    let weightedReturn = 0;
    for (const p of pricesByPosition) {
      const prev = p.prices.get(prevDate);
      const curr = p.prices.get(currDate);
      if (prev && curr && prev > 0) {
        weightedReturn += p.weight * (curr / prev - 1);
      }
    }
    indexValue = indexValue * (1 + weightedReturn);
    series.push({ date: currDate, close: indexValue });
  }
  return series;
}

function cagr(points: PricePoint[]): number | undefined {
  if (points.length < 2) return undefined;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const years = (new Date(last.date).getTime() - new Date(first.date).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  if (years <= 0 || first.close <= 0) return undefined;
  return (last.close / first.close) ** (1 / years) - 1;
}

function yearlyReturns(points: PricePoint[]): Map<number, number> {
  const byYear = new Map<number, PricePoint[]>();
  for (const p of points) {
    const y = new Date(p.date).getFullYear();
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y)!.push(p);
  }
  const out = new Map<number, number>();
  for (const [y, pts] of byYear) {
    if (pts.length < 2) continue;
    const first = pts[0]!.close;
    const last = pts[pts.length - 1]!.close;
    if (first > 0) out.set(y, last / first - 1);
  }
  return out;
}

export function computeReturnAnalysis(
  portfolioHistories: WeightedHistory[],
  benchmark: BenchmarkChoice,
  benchmarkHistory: PricePoint[] | undefined,
): ReturnAnalysis {
  const portfolioIndex = buildWeightedIndex(portfolioHistories);
  const disclaimer =
    'La rentabilidad histórica no garantiza ni permite predecir la rentabilidad futura. Se muestra únicamente con fines informativos y de contexto.';

  if (portfolioIndex.length === 0) {
    return {
      benchmark,
      series: [],
      dataCoverageWarning:
        'No hay histórico de precios suficiente y con fechas coincidentes entre las posiciones de la cartera para calcular una rentabilidad histórica fiable.',
      disclaimer,
    };
  }

  const annualizedReturnPct = cagr(portfolioIndex);
  const annualizedVolatilityPct = annualizedVolatility(dailyReturns(portfolioIndex));

  const portfolioYearly = yearlyReturns(portfolioIndex);
  const benchmarkYearly = benchmarkHistory ? yearlyReturns(benchmarkHistory) : new Map<number, number>();

  const years = Array.from(new Set([...portfolioYearly.keys()])).sort();
  const series: ReturnPoint[] = years.map((y) => ({
    periodLabel: String(y),
    portfolioReturnPct: portfolioYearly.get(y)! * 100,
    benchmarkReturnPct: benchmarkYearly.has(y) ? benchmarkYearly.get(y)! * 100 : undefined,
  }));

  const sharpeApprox =
    annualizedReturnPct !== undefined && annualizedVolatilityPct !== undefined && annualizedVolatilityPct > 0
      ? annualizedReturnPct / annualizedVolatilityPct
      : undefined;

  return {
    benchmark,
    series,
    annualizedReturnPct: annualizedReturnPct !== undefined ? annualizedReturnPct * 100 : undefined,
    annualizedVolatilityPct: annualizedVolatilityPct !== undefined ? annualizedVolatilityPct * 100 : undefined,
    sharpeApprox,
    dataCoverageWarning: !benchmarkHistory
      ? `No se ha podido obtener histórico del benchmark (${benchmark.name}) para comparar directamente.`
      : undefined,
    disclaimer,
  };
}
