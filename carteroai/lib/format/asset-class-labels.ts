import type { AssetClass } from '@/lib/types';

/**
 * Etiquetas legibles para el desglose "por tipo de activo" y la columna
 * "Clase" del informe. Centralizado aquí para que el informe web y el PDF
 * muestren siempre el mismo texto y no se olvide al añadir una clase nueva.
 */
export const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  equity: 'Acción',
  etf: 'ETF',
  fund: 'Fondo',
  commodity: 'Materias primas',
  bond: 'Bono',
  cash: 'Efectivo',
  crypto: 'Cripto',
  other: 'Otro',
};

export function assetClassLabel(assetClass: AssetClass): string {
  return ASSET_CLASS_LABELS[assetClass] ?? assetClass;
}
