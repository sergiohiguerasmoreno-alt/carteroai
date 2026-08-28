import type { Portfolio } from '@/lib/types';

/**
 * Resumen preliminar del PDF, calculado ANTES de hacer preguntas al
 * inversor. Sirve para decidir qué preguntas son necesarias (p.ej. si ya
 * sabemos que la cartera está 100% en un solo fondo mixto, no tiene sentido
 * preguntar por preferencias de vehículo tan a fondo) y para mostrar al
 * usuario, de forma transparente, qué ha "entendido" CarteroAI del documento.
 */
export interface PreliminarySummary {
  positionCount: number;
  assetClassesPresent: string[];
  currenciesPresent: string[];
  hasWeights: boolean;
  hasIsins: boolean;
  averageConfidence: 'high' | 'medium' | 'low';
  reliableEnough: boolean;
  reliabilityNote: string;
}

export function buildPreliminarySummary(portfolio: Portfolio): PreliminarySummary {
  const { positions } = portfolio;
  const assetClassesPresent = Array.from(new Set(positions.map((p) => p.assetClass)));
  const currenciesPresent = Array.from(new Set(positions.map((p) => p.currency).filter(Boolean))) as string[];
  const hasWeights = positions.some((p) => p.weightAsStated !== undefined);
  const hasIsins = positions.some((p) => !!p.isin);

  const score = { high: 2, medium: 1, low: 0 } as const;
  const avg =
    positions.length > 0
      ? positions.reduce((acc, p) => acc + score[p.extractionConfidence], 0) / positions.length
      : 0;
  const averageConfidence: 'high' | 'medium' | 'low' = avg >= 1.5 ? 'high' : avg >= 0.75 ? 'medium' : 'low';

  const reliableEnough = positions.length > 0 && averageConfidence !== 'low';

  const reliabilityNote = reliableEnough
    ? 'La extracción parece suficientemente fiable.'
    : 'La extracción tiene baja confianza global: es posible que alguna posición no se haya leído con exactitud. Esto se indicará en el informe final.';

  return {
    positionCount: positions.length,
    assetClassesPresent,
    currenciesPresent,
    hasWeights,
    hasIsins,
    averageConfidence,
    reliableEnough,
    reliabilityNote,
  };
}
