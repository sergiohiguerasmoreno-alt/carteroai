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

  it('imputa el valor de una posición sin precio/cantidad a partir de su peso declarado, calibrando con las posiciones que sí tienen valor y peso a la vez', () => {
    // Caso real reportado: un PDF de plan de aportación periódica da un
    // importe en €/mes (que aquí hace de "valor de mercado") para algunas
    // posiciones y solo un porcentaje para otras (p.ej. una acción suelta
    // sin importe). Antes, esas últimas se descartaban del todo y la
    // composición/diversificación mostraba solo el subconjunto valorado
    // como si fuera el 100% de la cartera.
    const portfolio: Portfolio = {
      id: 'p6',
      baseCurrency: 'EUR',
      sourceFileName: 'plan.pdf',
      extractedAt: new Date().toISOString(),
      extractionWarnings: [],
      positions: [
        pos({ id: 'etf1', name: 'ETF 1', assetClass: 'etf', marketValue: 102, currency: 'EUR', weightAsStated: 0.34 }),
        pos({ id: 'etf2', name: 'ETF 2', assetClass: 'etf', marketValue: 51, currency: 'EUR', weightAsStated: 0.17 }),
        // Sin marketValue ni cantidad×precio, solo peso declarado.
        pos({ id: 'nvda', name: 'NVDA', assetClass: 'equity', weightAsStated: 0.015 }),
      ],
    };

    const vp = computeValuedPortfolio(portfolio, { EUR: 1 });
    const nvda = vp.positions.find((p) => p.position.id === 'nvda')!;

    expect(nvda.valueBaseCcy).toBeCloseTo(4.5); // 0.015 * (153/0.51)
    expect(nvda.valueEstimatedFromStatedWeight).toBe(true);
    expect(nvda.weightPct).toBeCloseTo(0.015 / (0.34 + 0.17 + 0.015), 4);
    expect(vp.estimatedFromStatedWeightCount).toBe(1);
    expect(vp.unvaluedCount).toBe(0);
    // El total ahora refleja las tres posiciones, no solo las dos valoradas
    // directamente: 102 + 51 + 4.5 = 157.5.
    expect(vp.totalValueBaseCcy).toBeCloseTo(157.5);
  });

  it('no inventa un valor a partir del peso si ninguna posición valorada declara también un peso para calibrar', () => {
    const portfolio: Portfolio = {
      id: 'p7',
      baseCurrency: 'EUR',
      sourceFileName: 'test.pdf',
      extractedAt: new Date().toISOString(),
      extractionWarnings: [],
      positions: [
        pos({ id: 'a', name: 'A', marketValue: 1000, currency: 'EUR' }), // sin weightAsStated
        pos({ id: 'b', name: 'B', weightAsStated: 0.1 }), // sin valor, con peso
      ],
    };
    const vp = computeValuedPortfolio(portfolio, { EUR: 1 });
    const b = vp.positions.find((p) => p.position.id === 'b')!;
    expect(b.valueBaseCcy).toBeUndefined();
    expect(b.valueEstimatedFromStatedWeight).toBeUndefined();
    expect(vp.estimatedFromStatedWeightCount).toBe(0);
    expect(vp.unvaluedCount).toBe(1);
  });
});
