/**
 * Paleta categórica validada (ver skill de dataviz / references/palette.md).
 * Orden fijo: nunca se reasigna por rango ni se cicla más allá de 7 series;
 * a partir de ahí se pliega en "Otros" con el tono neutro `muted`.
 */
export const CATEGORICAL = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7'];

export const CHROME = {
  surface: '#ffffff',
  gridline: '#e1e0d9',
  axis: '#c3c2b7',
  textPrimary: '#0b0f14',
  textSecondary: '#5b6b7d',
  muted: '#8595a6',
};

export const STATUS = {
  good: '#0ca30c',
  warning: '#eda100',
  serious: '#ec835a',
  critical: '#d03b3b',
};

export interface Slice {
  label: string;
  weightPct: number;
}

/** Pliega las categorías menores en "Otros" para no saturar el gráfico. */
export function foldToTop(slices: Slice[], max = 7): Slice[] {
  if (slices.length <= max) return slices;
  const top = slices.slice(0, max);
  const restWeight = slices.slice(max).reduce((a, s) => a + s.weightPct, 0);
  return [...top, { label: 'Otros', weightPct: restWeight }];
}
