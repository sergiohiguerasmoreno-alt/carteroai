/**
 * Conversión de divisas. Recibe siempre un mapa de tipos de cambio ya
 * obtenido de la capa de datos de mercado (lib/market-data); esta función no
 * conoce ni inventa tipos de cambio.
 */

/** rates[CCY] = unidades de CCY por 1 unidad de baseCurrency. */
export type FxRateMap = Record<string, number>;

export function convertToBase(amount: number, fromCcy: string, baseCcy: string, rates: FxRateMap): number | undefined {
  if (fromCcy === baseCcy) return amount;
  const rate = rates[fromCcy];
  if (rate === undefined || rate === 0) return undefined;
  // rate = unidades fromCcy por 1 baseCcy => baseAmount = amount / rate
  return amount / rate;
}
