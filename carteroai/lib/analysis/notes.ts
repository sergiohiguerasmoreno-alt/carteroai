import type { EtfNote, FundamentalNote, MarketDataBundle, OverlapPair, Position } from '@/lib/types';

export function buildFundamentalNotes(positions: Position[], bundles: Map<string, MarketDataBundle>): FundamentalNote[] {
  const notes: FundamentalNote[] = [];
  for (const position of positions) {
    if (position.assetClass !== 'equity') continue;
    const f = bundles.get(position.id)?.fundamentals;
    if (!f) continue;

    const usedMetrics: string[] = [];
    const parts: string[] = [];

    if (f.revenueGrowthYoyPct !== undefined) {
      parts.push(`ingresos ${f.revenueGrowthYoyPct >= 0 ? 'crecieron' : 'cayeron'} un ${Math.abs(f.revenueGrowthYoyPct).toFixed(1)}% interanual`);
      usedMetrics.push('crecimiento de ingresos');
    }
    if (f.earningsGrowthYoyPct !== undefined) {
      parts.push(`el beneficio ${f.earningsGrowthYoyPct >= 0 ? 'creció' : 'cayó'} un ${Math.abs(f.earningsGrowthYoyPct).toFixed(1)}%`);
      usedMetrics.push('crecimiento de beneficios');
    }
    if (f.netMarginPct !== undefined) {
      parts.push(`margen neto del ${f.netMarginPct.toFixed(1)}%`);
      usedMetrics.push('margen neto');
    }
    if (f.peRatio !== undefined) {
      parts.push(`PER de ${f.peRatio.toFixed(1)}x`);
      usedMetrics.push('PER');
    }
    if (f.netDebtToEbitda !== undefined) {
      parts.push(`deuda neta/EBITDA de ${f.netDebtToEbitda.toFixed(1)}x`);
      usedMetrics.push('deuda neta/EBITDA');
    }
    if (f.dividendYieldPct !== undefined) {
      parts.push(`rentabilidad por dividendo del ${f.dividendYieldPct.toFixed(1)}%`);
      usedMetrics.push('dividendo');
    }

    const summary =
      parts.length > 0
        ? `Últimos datos disponibles: ${parts.join(', ')}.`
        : 'No hay suficientes datos fundamentales disponibles en la fuente configurada para esta empresa.';

    const missing = f.unavailableFields.length > 0 ? ` No disponibles: ${f.unavailableFields.join(', ')}.` : '';

    notes.push({
      positionId: position.id,
      label: position.name,
      summary: summary + missing,
      metricsUsed: usedMetrics,
      confidence: usedMetrics.length >= 3 ? 'medium' : 'low',
    });
  }
  return notes;
}

export function buildEtfNotes(positions: Position[], bundles: Map<string, MarketDataBundle>, overlaps: OverlapPair[]): EtfNote[] {
  const notes: EtfNote[] = [];
  for (const position of positions) {
    if (position.assetClass !== 'etf' && position.assetClass !== 'fund') continue;
    const etf = bundles.get(position.id)?.etf;

    const redundantWith = overlaps
      .filter((o) => o.basis === 'holdings_data' && o.overlapScore >= 0.3 && (o.aName === position.name || o.bName === position.name))
      .map((o) => (o.aName === position.name ? o.bName : o.aName));

    if (!etf) {
      notes.push({
        positionId: position.id,
        label: position.name,
        summary: 'No se han podido obtener datos de composición, TER ni distribución de este producto con las fuentes configuradas.',
        redundantWith: redundantWith.length > 0 ? redundantWith : undefined,
        confidence: 'low',
      });
      continue;
    }

    const parts: string[] = [];
    if (etf.terPct !== undefined) parts.push(`TER del ${(etf.terPct * 100).toFixed(2)}%`);
    if (etf.numberOfHoldings !== undefined) parts.push(`${etf.numberOfHoldings} posiciones`);
    if (etf.topHoldings && etf.topHoldings.length > 0) {
      parts.push(`principal posición: ${etf.topHoldings[0]!.symbolOrName} (${etf.topHoldings[0]!.weightPct.toFixed(1)}%)`);
    }
    const missing = etf.unavailableFields.length > 0 ? ` No disponible: ${etf.unavailableFields.join(', ')}.` : '';

    notes.push({
      positionId: position.id,
      label: position.name,
      summary: (parts.length > 0 ? parts.join(', ') + '.' : 'Datos muy limitados disponibles.') + missing,
      redundantWith: redundantWith.length > 0 ? redundantWith : undefined,
      confidence: parts.length >= 2 ? 'medium' : 'low',
    });
  }
  return notes;
}
