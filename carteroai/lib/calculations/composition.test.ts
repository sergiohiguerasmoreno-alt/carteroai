import { describe, expect, it } from 'vitest';
import { computeComposition } from './composition';
import { computeValuedPortfolio } from './weights';
import type { Portfolio, Position } from '@/lib/types';

function pos(overrides: Partial<Position>): Position {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    name: 'Test',
    assetClass: 'equity',
    extractionConfidence: 'high',
    userConfirmed: true,
    userEdited: false,
    ...overrides,
  };
}

describe('computeComposition — cartera con ETFs, materias primas y acciones sin valor de mercado explícito', () => {
  // Reproduce el caso real reportado: un PDF de plan de aportación
  // periódica da un importe en €/mes para los ETFs y la posición de
  // materias primas, pero solo un porcentaje (sin importe) para varias
  // acciones sueltas. Antes del arreglo de computeValuedPortfolio, esas
  // acciones se descartaban del todo y "por tipo de activo" mostraba 100%
  // ETF como si la cartera no tuviera ni materias primas ni acciones.
  const portfolio: Portfolio = {
    id: 'p1',
    baseCurrency: 'EUR',
    sourceFileName: 'plan.pdf',
    extractedAt: new Date().toISOString(),
    extractionWarnings: [],
    positions: [
      pos({ id: 'w', name: 'MSCI World (IWDA)', assetClass: 'etf', marketValue: 102, currency: 'EUR', weightAsStated: 0.34 }),
      pos({ id: 'e', name: 'MSCI Europe (IMEU)', assetClass: 'etf', marketValue: 51, currency: 'EUR', weightAsStated: 0.17 }),
      pos({ id: 'c', name: 'Materias primas', assetClass: 'commodity', marketValue: 23.25, currency: 'EUR', weightAsStated: 0.0775 }),
      pos({ id: 'nvda', name: 'NVDA', assetClass: 'equity', weightAsStated: 0.015 }),
      pos({ id: 'jnj', name: 'Johnson & Johnson', assetClass: 'equity', weightAsStated: 0.02 }),
    ],
  };

  const vp = computeValuedPortfolio(portfolio, { EUR: 1 });
  const composition = computeComposition(vp, new Map());

  it('no reduce "por tipo de activo" a una sola clase: incluye ETF, materias primas y acciones', () => {
    const labels = composition.byAssetClass.map((s) => s.label);
    expect(labels).toContain('etf');
    expect(labels).toContain('commodity');
    expect(labels).toContain('equity');
  });

  it('el peso de "equity" no es cero aunque esas posiciones no tuvieran marketValue explícito', () => {
    const equitySlice = composition.byAssetClass.find((s) => s.label === 'equity');
    expect(equitySlice?.weightPct).toBeGreaterThan(0);
  });

  it('ninguna clase concentra el 100%: la suma de ETF no eclipsa a materias primas ni a acciones', () => {
    const etfSlice = composition.byAssetClass.find((s) => s.label === 'etf');
    expect(etfSlice?.weightPct).toBeLessThan(1);
  });

  it('el desglose por posición sigue incluyendo a las acciones sin valor de mercado explícito', () => {
    const names = composition.byAsset.map((s) => s.label);
    expect(names).toContain('NVDA');
    expect(names).toContain('Johnson & Johnson');
  });
});
