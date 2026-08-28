import { describe, expect, it } from 'vitest';
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

describe('computeValuedPortfolio', () => {
  it('calcula pesos correctos en divisa base sin conversión', () => {
    const portfolio: Portfolio = {
      id: 'p1',
      baseCurrency: 'EUR',
      sourceFileName: 'test.pdf',
      extractedAt: new Date().toISOString(),
      extractionWarnings: [],
      positions: [
        pos({ id: 'a', name: 'A', marketValue: 6000, currency: 'EUR' }),
        pos({ id: 'b', name: 'B', marketValue: 4000, currency: 'EUR' }),
      ],
    };

    const vp = computeValuedPortfolio(portfolio, { EUR: 1 });
    expect(vp.totalValueBaseCcy).toBeCloseTo(10000);
    const a = vp.positions.find((p) => p.position.id === 'a')!;
    const b = vp.positions.find((p) => p.position.id === 'b')!;
    expect(a.weightPct).toBeCloseTo(0.6);
    expect(b.weightPct).toBeCloseTo(0.4);
  });

  it('convierte divisas usando el mapa de tipos de cambio', () => {
    const portfolio: Portfolio = {
      id: 'p2',
      baseCurrency: 'EUR',
      sourceFileName: 'test.pdf',
      extractedAt: new Date().toISOString(),
      extractionWarnings: [],
      positions: [pos({ id: 'usd', name: 'USD pos', marketValue: 110, currency: 'USD' })],
    };
    // 1 EUR = 1.10 USD -> 110 USD = 100 EUR
    const vp = computeValuedPortfolio(portfolio, { USD: 1.1 });
    expect(vp.positions[0]!.valueBaseCcy).toBeCloseTo(100);
  });

  it('calcula cantidad x precio cuando no hay marketValue explícito', () => {
    const portfolio: Portfolio = {
      id: 'p3',
      baseCurrency: 'EUR',
      sourceFileName: 'test.pdf',
      extractedAt: new Date().toISOString(),
      extractionWarnings: [],
      positions: [pos({ id: 'qp', name: 'Qty*Price', quantity: 10, price: 25, currency: 'EUR' })],
    };
    const vp = computeValuedPortfolio(portfolio, { EUR: 1 });
    expect(vp.positions[0]!.valueBaseCcy).toBeCloseTo(250);
  });

  it('marca como no valorable una posición sin datos suficientes', () => {
    const portfolio: Portfolio = {
      id: 'p4',
      baseCurrency: 'EUR',
      sourceFileName: 'test.pdf',
      extractedAt: new Date().toISOString(),
      extractionWarnings: [],
      positions: [pos({ id: 'empty', name: 'Sin datos' })],
    };
    const vp = computeValuedPortfolio(portfolio, { EUR: 1 });
    expect(vp.unvaluedCount).toBe(1);
    expect(vp.positions[0]!.valueBaseCcy).toBeUndefined();
    expect(vp.positions[0]!.valuationNote).toBeDefined();
  });

  it('marca como no valorable si falta el tipo de cambio de su divisa', () => {
    const portfolio: Portfolio = {
      id: 'p5',
      baseCurrency: 'EUR',
      sourceFileName: 'test.pdf',
      extractedAt: new Date().toISOString(),
      extractionWarnings: [],
      positions: [pos({ id: 'gbp', name: 'GBP pos', marketValue: 100, currency: 'GBP' })],
    };
    const vp = computeValuedPortfolio(portfolio, { EUR: 1 }); // sin tipo GBP
    expect(vp.positions[0]!.valueBaseCcy).toBeUndefined();
    expect(vp.unvaluedCount).toBe(1);
  });
});
