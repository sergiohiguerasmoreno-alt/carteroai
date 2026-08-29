import type { ConfirmedPortfolio, Position } from '@/lib/types';
import { convertToBase, type FxRateMap } from './currency';

export interface ValuedPosition {
  position: Position;
  valueBaseCcy?: number;
  weightPct?: number; // 0-1, recalculado por código (no el declarado en el PDF)
  valuationNote?: string;
  /**
   * true si valueBaseCcy no viene de un precio/cantidad/valor de mercado
   * real, sino que se ha imputado a partir del peso declarado en el
   * documento (ver computeValuedPortfolio). El peso resultante es una
   * estimación proporcional, no un dato de mercado.
   */
  valueEstimatedFromStatedWeight?: boolean;
}

export interface ValuedPortfolio {
  baseCurrency: string;
  totalValueBaseCcy: number;
  positions: ValuedPosition[];
  unvaluedCount: number;
  /** Nº de posiciones cuyo valor se ha imputado a partir del peso declarado, no de un dato de mercado. */
  estimatedFromStatedWeightCount: number;
}

/**
 * Calcula el valor de mercado en divisa base y el peso real de cada
 * posición. Nunca usa el peso "tal y como aparece en el PDF" como fuente de
 * verdad para las posiciones que sí tienen precio/cantidad/valor: lo
 * recalcula a partir de esos datos, para poder detectar y avisar de
 * inconsistencias.
 *
 * Algunos documentos (planes de aportación periódica, resúmenes tipo
 * "tarjeta"...) solo dan un precio/valor de mercado para ALGUNAS posiciones
 * y para el resto únicamente un peso porcentual. Descartar esas posiciones
 * del análisis (como hacía antes esta función) falseaba la composición,
 * diversificación y desglose por sector/región/tipo de activo, mostrando el
 * pequeño subconjunto valorado como si fuera el 100% de la cartera. Para
 * evitarlo, a esas posiciones se les imputa un valor proporcional a su peso
 * declarado, calibrado con la(s) posición(es) que sí tienen valor de mercado
 * Y peso declarado a la vez (para obtener una proporción "euros por punto de
 * peso" empírica del propio documento). Si ninguna posición valorada declara
 * también un peso, no hay con qué calibrar y esas posiciones se quedan sin
 * valorar, igual que antes: nunca se inventa una proporción sin referencia.
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

  const directlyValued: ValuedPosition[] = withRawValue.map(({ position, nativeValue }) => {
    if (nativeValue === undefined) {
      return { position };
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

  const calibrationSet = directlyValued.filter((v) => v.valueBaseCcy !== undefined && v.position.weightAsStated !== undefined);
  const calibrationValueSum = calibrationSet.reduce((acc, v) => acc + v.valueBaseCcy!, 0);
  const calibrationWeightSum = calibrationSet.reduce((acc, v) => acc + v.position.weightAsStated!, 0);
  const impliedValuePerWeightUnit = calibrationSet.length > 0 && calibrationWeightSum > 0 ? calibrationValueSum / calibrationWeightSum : undefined;

  const valued: ValuedPosition[] = directlyValued.map((v) => {
    if (v.valueBaseCcy !== undefined) return v;
    if (v.valuationNote) return v; // fallo de tipo de cambio: dato real pero no convertible, no se estima por peso
    if (impliedValuePerWeightUnit !== undefined && v.position.weightAsStated !== undefined) {
      return {
        position: v.position,
        valueBaseCcy: v.position.weightAsStated * impliedValuePerWeightUnit,
        valueEstimatedFromStatedWeight: true,
      };
    }
    return {
      position: v.position,
      valuationNote: 'Sin cantidad, precio o valor de mercado suficientes para valorar esta posición.',
    };
  });

  const totalValueBaseCcy = valued.reduce((acc, v) => acc + (v.valueBaseCcy ?? 0), 0);
  const unvaluedCount = valued.filter((v) => v.valueBaseCcy === undefined).length;
  const estimatedFromStatedWeightCount = valued.filter((v) => v.valueEstimatedFromStatedWeight).length;

  const withWeights = valued.map((v) => ({
    ...v,
    weightPct: v.valueBaseCcy !== undefined && totalValueBaseCcy > 0 ? v.valueBaseCcy / totalValueBaseCcy : undefined,
  }));

  return { baseCurrency: base, totalValueBaseCcy, positions: withWeights, unvaluedCount, estimatedFromStatedWeightCount };
}
