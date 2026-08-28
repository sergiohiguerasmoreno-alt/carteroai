import type { ConfirmedPortfolio, Position } from '@/lib/types';
import { convertToBase, type FxRateMap } from './currency';

export interface ValuedPosition {
  position: Position;
  valueBaseCcy?: number;
  weightPct?: number; // 0-1, recalculado por código (no el declarado en el PDF)
  valuationNote?: string;
}

export interface ValuedPortfolio {
  baseCurrency: string;
  totalValueBaseCcy: number;
  positions: ValuedPosition[];
  unvaluedCount: number;
}

/**
 * Calcula el valor de mercado en divisa base y el peso real de cada
 * posición. Nunca usa el peso "tal y como aparece en el PDF" como fuente de
 * verdad: lo recalcula a partir de cantidad×precio o del valor declarado,
 * para poder detectar y avisar de inconsistencias.
 */
export function computeValuedPortfolio(portfolio: ConfirmedPortfolio, fxRates: FxRateMap): ValuedPortfolio {
  const base = portfolio.baseCurrency;

  const withRawValue = portfolio.positions.map((p) => {
    let nativeValue = p.marketValue;
    if (nativeValue === undefined && p.quantity !== undefined && p.price !== undefined) {
      nativeValue = p.quantity * p.price;
    }
    return { position: p, nativeValue };
  });

  const valued: ValuedPosition[] = withRawValue.map(({ position, nativeValue }) => {
    if (nativeValue === undefined) {
      return {
        position,
        valuationNote: 'Sin cantidad, precio o valor de mercado suficientes para valorar esta posición.',
      };
    }
    const ccy = position.currency ?? base;
    const valueBaseCcy = convertToBase(nativeValue, ccy, base, fxRates);
    if (valueBaseCcy === undefined) {
      return {
        position,
        valuationNote: `No se dispone de tipo de cambio ${ccy}/${base} para convertir esta posición.`,
      };
    }
    return { position, valueBaseCcy };
  });

  const totalValueBaseCcy = valued.reduce((acc, v) => acc + (v.valueBaseCcy ?? 0), 0);
  const unvaluedCount = valued.filter((v) => v.valueBaseCcy === undefined).length;

  const withWeights = valued.map((v) => ({
    ...v,
    weightPct: v.valueBaseCcy !== undefined && totalValueBaseCcy > 0 ? v.valueBaseCcy / totalValueBaseCcy : undefined,
  }));

  return { baseCurrency: base, totalValueBaseCcy, positions: withWeights, unvaluedCount };
}
