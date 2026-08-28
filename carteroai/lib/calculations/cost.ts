export interface CostInput {
  positionId: string;
  weight: number;
  terPct?: number; // 0-1
  assetClass: string;
}

export interface CostAnalysis {
  weightedTerPct?: number;
  coverageWeight: number; // proporción de la cartera con TER conocido (solo aplica a ETF/fondo)
  estimatedAnnualCostBaseCcy?: number;
  note: string;
}

export function computeCostAnalysis(inputs: CostInput[], totalValueBaseCcy: number): CostAnalysis {
  const fundLike = inputs.filter((i) => i.assetClass === 'etf' || i.assetClass === 'fund');
  const withTer = fundLike.filter((i) => i.terPct !== undefined);
  const coverageWeight = fundLike.reduce((a, b) => a + b.weight, 0);

  if (withTer.length === 0) {
    return {
      coverageWeight,
      note:
        fundLike.length > 0
          ? 'No se ha podido obtener el TER de los ETFs/fondos de la cartera con las fuentes configuradas actualmente.'
          : 'La cartera no contiene ETFs ni fondos con comisión de gestión explícita (TER); no se calcula coste ponderado.',
    };
  }

  const sumWeight = withTer.reduce((a, b) => a + b.weight, 0);
  const weightedTerPct = withTer.reduce((a, b) => a + (b.terPct ?? 0) * b.weight, 0) / (sumWeight || 1);
  const estimatedAnnualCostBaseCcy = weightedTerPct * totalValueBaseCcy * (sumWeight / (coverageWeight || 1));

  return {
    weightedTerPct,
    coverageWeight,
    estimatedAnnualCostBaseCcy,
    note: `TER ponderado calculado sobre el ${(sumWeight * 100).toFixed(0)}% de la cartera con dato disponible (de un ${(coverageWeight * 100).toFixed(0)}% invertido en ETFs/fondos).`,
  };
}
