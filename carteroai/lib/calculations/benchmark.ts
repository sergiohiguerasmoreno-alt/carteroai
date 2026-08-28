import type { AllocationSlice, BenchmarkChoice } from '@/lib/types';

/**
 * Selección de benchmark basada en reglas explícitas sobre la composición
 * real de la cartera (nunca un benchmark fijo por defecto). El símbolo
 * devuelto se resuelve después contra el proveedor de precios; si no se
 * puede obtener su histórico, la comparación se omite explícitamente en
 * vez de inventarse.
 */
export function selectBenchmark(byGeography: AllocationSlice[], byAssetClass: AllocationSlice[]): BenchmarkChoice {
  const equityLike = byAssetClass.filter((a) => a.label === 'equity' || a.label === 'etf' || a.label === 'fund');
  const equityWeight = equityLike.reduce((a, b) => a + b.weightPct, 0);
  const bondWeight = byAssetClass.find((a) => a.label === 'bond')?.weightPct ?? 0;

  const us = byGeography.find((g) => /estados unidos|usa|united states|north america|américa del norte/i.test(g.label));
  const europe = byGeography.find((g) => /europa|europe|eurozone|zona euro/i.test(g.label));
  const global = byGeography.find((g) => /global|world|mundial/i.test(g.label));

  if (bondWeight >= 0.4) {
    return {
      name: 'Cartera mixta (renta variable/renta fija) — sin índice único representativo',
      rationale:
        `La cartera combina renta variable y renta fija de forma relevante (~${(bondWeight * 100).toFixed(0)}% en renta fija), por lo que ningún índice bursátil único sería representativo. Se compara cada bloque por separado cuando hay datos suficientes, en vez de forzar un benchmark mixto arbitrario.`,
    };
  }

  if (us && us.weightPct >= 0.65) {
    return {
      name: 'S&P 500',
      symbol: '^spx',
      rationale: `Más del ${(us.weightPct * 100).toFixed(0)}% de la exposición geográfica detectada está en Estados Unidos, por lo que el S&P 500 es la referencia más representativa del riesgo de mercado que asume la cartera.`,
    };
  }

  if (europe && europe.weightPct >= 0.55) {
    return {
      name: 'Euro Stoxx 50',
      symbol: '^stoxx50e',
      rationale: `Más del ${(europe.weightPct * 100).toFixed(0)}% de la exposición geográfica detectada está en Europa/zona euro, por lo que un índice europeo amplio es más representativo que uno global o estadounidense.`,
    };
  }

  if (global || equityWeight >= 0.5) {
    return {
      name: 'MSCI World',
      symbol: 'urth.us',
      rationale:
        'La cartera muestra una exposición geográfica diversificada entre varias regiones desarrolladas, sin una concentración dominante en un único país o bloque, por lo que un índice global de renta variable desarrollada es la referencia más adecuada.',
    };
  }

  return {
    name: 'MSCI ACWI (referencia orientativa)',
    rationale:
      'No se ha podido determinar con suficiente certeza la distribución geográfica de la cartera, por lo que se usa como referencia orientativa un índice global amplio (mercados desarrollados y emergentes). La comparación debe interpretarse con cautela.',
  };
}
