import 'server-only';
import type { SourceRef } from '@/lib/types';
import type { FxRateMap } from '@/lib/calculations/currency';
import { fetchJson } from '../http';

/**
 * Tipos de cambio de referencia del BCE, vía Frankfurter (sin clave de API).
 * Frankfurter cubre divisas principales; si una divisa de la cartera no
 * está soportada, esa posición quedará marcada como "no valorable" en vez
 * de asumir un tipo de cambio inventado.
 */
interface FrankfurterResponse {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
}

export interface FxResult {
  rates: FxRateMap;
  source: SourceRef;
}

export async function getFxRates(baseCurrency: string): Promise<FxResult | undefined> {
  const url = `https://api.frankfurter.app/latest?base=${encodeURIComponent(baseCurrency)}`;
  const data = await fetchJson<FrankfurterResponse>(url);
  if (!data?.rates) return undefined;
  return {
    rates: data.rates,
    source: {
      provider: 'Frankfurter (tipos de referencia BCE)',
      url,
      retrievedAt: new Date().toISOString(),
      fieldsUsed: [`tipos de cambio respecto a ${baseCurrency}`],
    },
  };
}
