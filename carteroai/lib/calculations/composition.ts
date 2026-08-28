import type { AllocationSlice, CompositionAnalysis } from '@/lib/types';
import type { ValuedPortfolio } from './weights';

/**
 * Reparto fraccional del valor de UNA posición entre etiquetas (sector o
 * geografía). Para una acción individual normalmente es {"Tecnología": 1}.
 * Para un ETF diversificado, son las fracciones reales de su cartera
 * subyacente, p.ej. {"EE.UU.": 0.65, "Europa": 0.2, ...}. Si las fracciones
 * conocidas no suman 1, el resto se imputa a "Sin clasificar" para no
 * inventar la parte no verificada.
 */
export type LabelBreakdown = Record<string, number>;

export interface PositionEnrichment {
  sector?: LabelBreakdown;
  geography?: LabelBreakdown;
}

const UNCLASSIFIED = 'Sin clasificar';

function normalizedBreakdown(breakdown: LabelBreakdown | undefined): LabelBreakdown {
  if (!breakdown) return { [UNCLASSIFIED]: 1 };
  const sum = Object.values(breakdown).reduce((a, b) => a + b, 0);
  if (sum <= 0) return { [UNCLASSIFIED]: 1 };
  const out: LabelBreakdown = {};
  for (const [k, v] of Object.entries(breakdown)) out[k] = v / Math.max(sum, 1);
  const remainder = 1 - Math.min(sum, 1);
  if (remainder > 0.01) out[UNCLASSIFIED] = (out[UNCLASSIFIED] ?? 0) + remainder;
  return out;
}

function aggregateSimple(vp: ValuedPortfolio, keyFn: (positionId: string) => string): AllocationSlice[] {
  const map = new Map<string, number>();
  for (const v of vp.positions) {
    if (v.valueBaseCcy === undefined) continue;
    const key = keyFn(v.position.id);
    map.set(key, (map.get(key) ?? 0) + v.valueBaseCcy);
  }
  return toSlices(map, vp.totalValueBaseCcy);
}

function aggregateFractional(
  vp: ValuedPortfolio,
  breakdownFn: (positionId: string) => LabelBreakdown | undefined,
): AllocationSlice[] {
  const map = new Map<string, number>();
  for (const v of vp.positions) {
    if (v.valueBaseCcy === undefined) continue;
    const breakdown = normalizedBreakdown(breakdownFn(v.position.id));
    for (const [label, fraction] of Object.entries(breakdown)) {
      map.set(label, (map.get(label) ?? 0) + v.valueBaseCcy * fraction);
    }
  }
  return toSlices(map, vp.totalValueBaseCcy);
}

function toSlices(map: Map<string, number>, total: number): AllocationSlice[] {
  return Array.from(map.entries())
    .map(([label, valueBaseCcy]) => ({ label, valueBaseCcy, weightPct: total > 0 ? valueBaseCcy / total : 0 }))
    .sort((a, b) => b.weightPct - a.weightPct);
}

function herfindahl(slices: AllocationSlice[]): number {
  return slices.reduce((acc, s) => acc + s.weightPct * s.weightPct, 0);
}

export function computeComposition(vp: ValuedPortfolio, enrichment: Map<string, PositionEnrichment>): CompositionAnalysis {
  const byAsset = aggregateSimple(vp, (id) => vp.positions.find((p) => p.position.id === id)?.position.name ?? id);
  const bySector = aggregateFractional(vp, (id) => enrichment.get(id)?.sector);
  const byGeography = aggregateFractional(vp, (id) => enrichment.get(id)?.geography);
  const byCurrency = aggregateSimple(vp, (id) => vp.positions.find((p) => p.position.id === id)?.position.currency ?? vp.baseCurrency);
  const byAssetClass = aggregateSimple(vp, (id) => vp.positions.find((p) => p.position.id === id)?.position.assetClass ?? 'other');

  const byPosition = vp.positions
    .filter((v) => v.valueBaseCcy !== undefined)
    .map((v) => ({ label: v.position.name, valueBaseCcy: v.valueBaseCcy!, weightPct: v.weightPct ?? 0 }))
    .sort((a, b) => b.weightPct - a.weightPct);

  const concentrationHhi = herfindahl(byPosition);
  const topPositionWeightPct = byPosition[0]?.weightPct ?? 0;
  const top5WeightPct = byPosition.slice(0, 5).reduce((acc, p) => acc + p.weightPct, 0);

  const unclassifiedWeight = (bySector.find((s) => s.label === UNCLASSIFIED)?.weightPct ?? 0);
  const unclassifiedGeoWeight = (byGeography.find((s) => s.label === UNCLASSIFIED)?.weightPct ?? 0);
  const dataCompletenessPct = 1 - Math.max(unclassifiedWeight, unclassifiedGeoWeight);

  return {
    byAsset,
    bySector,
    byGeography,
    byCurrency,
    byAssetClass,
    concentrationHhi,
    topPositionWeightPct,
    top5WeightPct,
    dataCompletenessPct: Math.max(0, dataCompletenessPct),
  };
}
