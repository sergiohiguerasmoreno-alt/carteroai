import type { CompositionAnalysis, DiversificationAnalysis, OverlapPair } from '@/lib/types';
import type { EtfHolding } from '@/lib/types';
import type { ValuedPortfolio } from './weights';

const SECTOR_CONCENTRATION_THRESHOLD = 0.4; // 40% en un solo sector
const COUNTRY_CONCENTRATION_THRESHOLD = 0.5; // 50% en un solo país/región
const OVERLAP_NOTABLE_THRESHOLD = 0.3; // 30% de solapamiento estimado

export interface HoldingsLookup {
  /** holdings por posición (solo para ETFs/fondos con datos disponibles). */
  get(positionId: string): EtfHolding[] | undefined;
}

/** Solapamiento ponderado entre dos listas de principales posiciones de ETFs/fondos. */
function estimateOverlap(a: EtfHolding[], b: EtfHolding[]): { score: number; shared: string[] } {
  const mapB = new Map(b.map((h) => [normalizeName(h.symbolOrName), h.weightPct]));
  let overlapSum = 0;
  const shared: string[] = [];
  for (const h of a) {
    const key = normalizeName(h.symbolOrName);
    const wB = mapB.get(key);
    if (wB !== undefined) {
      overlapSum += Math.min(h.weightPct, wB);
      shared.push(h.symbolOrName);
    }
  }
  // Se acota a los "top holdings" disponibles: el resultado es una cota
  // inferior conservadora del solapamiento real, nunca una cifra exacta.
  return { score: Math.min(overlapSum, 1), shared: shared.slice(0, 8) };
}

function normalizeName(s: string): string {
  return s.trim().toUpperCase().replace(/[.,]/g, '');
}

export function computeDiversification(
  vp: ValuedPortfolio,
  composition: CompositionAnalysis,
  holdingsLookup: HoldingsLookup,
): DiversificationAnalysis {
  const effectiveNumberOfBets = composition.concentrationHhi > 0 ? 1 / composition.concentrationHhi : 0;

  const fundLike = vp.positions.filter(
    (v) => (v.position.assetClass === 'etf' || v.position.assetClass === 'fund') && v.weightPct !== undefined,
  );

  const overlapPairs: OverlapPair[] = [];
  for (let i = 0; i < fundLike.length; i++) {
    for (let j = i + 1; j < fundLike.length; j++) {
      const posA = fundLike[i]!.position;
      const posB = fundLike[j]!.position;
      const holdingsA = holdingsLookup.get(posA.id);
      const holdingsB = holdingsLookup.get(posB.id);
      if (!holdingsA || !holdingsB) {
        overlapPairs.push({
          aName: posA.name,
          bName: posB.name,
          overlapScore: 0,
          sharedTopHoldings: [],
          basis: 'unavailable',
        });
        continue;
      }
      const { score, shared } = estimateOverlap(holdingsA, holdingsB);
      overlapPairs.push({ aName: posA.name, bName: posB.name, overlapScore: score, sharedTopHoldings: shared, basis: 'holdings_data' });
    }
  }

  const hiddenConcentrationNotes: string[] = [];
  const notableOverlaps = overlapPairs.filter((o) => o.basis === 'holdings_data' && o.overlapScore >= OVERLAP_NOTABLE_THRESHOLD);
  for (const o of notableOverlaps) {
    hiddenConcentrationNotes.push(
      `"${o.aName}" y "${o.bName}" comparten un solapamiento estimado del ${(o.overlapScore * 100).toFixed(0)}% en sus principales posiciones (${o.sharedTopHoldings.slice(0, 4).join(', ')}${o.sharedTopHoldings.length > 4 ? '…' : ''}). Parte de la "diversificación" entre ambos productos puede ser aparente.`,
    );
  }
  const unavailableOverlaps = overlapPairs.filter((o) => o.basis === 'unavailable');
  if (unavailableOverlaps.length > 0) {
    hiddenConcentrationNotes.push(
      `No se ha podido verificar el solapamiento de holdings entre ${unavailableOverlaps.length} par(es) de ETFs/fondos por falta de datos de composición. No se asume solapamiento ni ausencia de él.`,
    );
  }

  const topSector = composition.bySector[0];
  const singleSectorExposurePct =
    topSector && topSector.label !== 'Sin clasificar' && topSector.weightPct >= SECTOR_CONCENTRATION_THRESHOLD
      ? { sector: topSector.label, pct: topSector.weightPct }
      : undefined;

  const topGeo = composition.byGeography[0];
  const singleCountryExposurePct =
    topGeo && topGeo.label !== 'Sin clasificar' && topGeo.weightPct >= COUNTRY_CONCENTRATION_THRESHOLD
      ? { country: topGeo.label, pct: topGeo.weightPct }
      : undefined;

  const parts: string[] = [];
  parts.push(
    `Número efectivo de posiciones independientes: ${effectiveNumberOfBets.toFixed(1)} (cuanto más cercano al número real de posiciones, más repartido está el riesgo).`,
  );
  if (singleSectorExposurePct) {
    parts.push(`Exposición sectorial concentrada en ${singleSectorExposurePct.sector} (${(singleSectorExposurePct.pct * 100).toFixed(0)}%).`);
  }
  if (singleCountryExposurePct) {
    parts.push(`Exposición geográfica concentrada en ${singleCountryExposurePct.country} (${(singleCountryExposurePct.pct * 100).toFixed(0)}%).`);
  }
  if (notableOverlaps.length > 0) {
    parts.push(`Se ha detectado solapamiento relevante entre ${notableOverlaps.length} par(es) de productos.`);
  }
  if (parts.length === 1) {
    parts.push('No se han detectado concentraciones ocultas relevantes con los datos disponibles.');
  }

  return {
    effectiveNumberOfBets,
    overlapPairs,
    hiddenConcentrationNotes,
    singleCountryExposurePct,
    singleSectorExposurePct,
    summary: parts.join(' '),
  };
}

export function buildHoldingsLookup(map: Map<string, EtfHolding[]>): HoldingsLookup {
  return { get: (id: string) => map.get(id) };
}
