import { describe, expect, it } from 'vitest';
import { extractPositionsFromText } from './position-extractor';

describe('extractPositionsFromText — extracto tabular típico', () => {
  const text = [
    'ISHARES CORE MSCI WORLD ETF IE00B4L5Y983 10.248,00 84,20 8.628,89 EUR',
    'VANGUARD FTSE ALL-WORLD IE00BK5BQT80 3.500,00 112,40 393.400,00 EUR',
    'CUENTA CORRIENTE EUR 1.204,50 EUR',
    'TOTAL CARTERA 402.233,39 EUR',
  ].join('\n');

  const portfolio = extractPositionsFromText(text, 'extracto.pdf');

  it('extrae las posiciones reales con ISIN', () => {
    const names = portfolio.positions.map((p) => p.name);
    expect(names).toContain('ISHARES CORE MSCI WORLD ETF');
    expect(names).toContain('VANGUARD FTSE ALL-WORLD');
  });

  it('no convierte la fila de total en una posición', () => {
    expect(portfolio.positions.some((p) => p.name.toUpperCase().startsWith('TOTAL'))).toBe(false);
  });

  it('asigna confianza alta a filas con ISIN, cantidad, precio y valor', () => {
    const world = portfolio.positions.find((p) => p.isin === 'IE00B4L5Y983');
    expect(world?.extractionConfidence).toBe('high');
    expect(world?.marketValue).toBeCloseTo(8628.89);
  });
});

describe('extractPositionsFromText — documento tipo tarjeta/infografía (no tabular)', () => {
  // Fragmento real (anonimizado en el nombre de archivo) de un PDF de plan de
  // aportación periódica: varias "tarjetas" por posición reconstruidas por
  // pdfjs en líneas que mezclan nombre, ticker, % y descripción con "·".
  const text = [
    'Cartera de Inversión',
    'Perfil moderado · Horizonte 2–5 años · 300 €/mes · Plataforma N26',
    'MSCI World (IWDA)  34%  102 €/mes',
    'NÚCLEO PASIVO — 51% · 153 €/MES',
    'TECNOLOGÍA — 5 EMPRESAS · 10%',
    'Rating AAA · 61 años subiendo dividendo · oncología e inmunología · yield ~3.1% 6 €/mes',
    'Johnson & Johnson 2%',
    'creciente 14 años · yield ~1.3% iniciado 2024 · yield ~0.5%',
    'ETFs — 63.5%',
    'Generado el 18 de abril de 2025 · Cartera de inversión personal · Solo informativo, no es asesoramiento financiero',
  ].join('\n');

  const portfolio = extractPositionsFromText(text, 'plan.pdf');

  it('no fabrica una posición a partir de la descripción del perfil inversor', () => {
    expect(portfolio.positions.some((p) => p.name.includes('Perfil moderado'))).toBe(false);
  });

  it('no fabrica posiciones a partir de líneas con varios fragmentos separados por "·"', () => {
    // "Rating AAA · 61 años..." no debe convertirse en una posición con
    // marketValue 61 (leído por error de "61 años").
    expect(portfolio.positions.some((p) => p.marketValue === 61)).toBe(false);
    // "creciente 14 años · ... iniciado 2024 ..." no debe convertirse en una
    // posición con marketValue 2024 (leído por error del año).
    expect(portfolio.positions.some((p) => p.marketValue === 2024)).toBe(false);
  });

  it('no fabrica una posición a partir del pie de fecha de generación', () => {
    expect(portfolio.positions.some((p) => p.marketValue === 2025)).toBe(false);
  });

  it('no convierte cabeceras de sección/subtotal en posiciones', () => {
    const names = portfolio.positions.map((p) => p.name.toUpperCase());
    expect(names.some((n) => n.startsWith('NÚCLEO PASIVO'))).toBe(false);
    expect(names.some((n) => n.startsWith('TECNOLOGÍA'))).toBe(false);
    expect(names.some((n) => n === 'ETFS — 63.5%')).toBe(false);
  });

  it('sí conserva las posiciones reales identificables (nombre + peso o importe)', () => {
    const names = portfolio.positions.map((p) => p.name);
    expect(names).toContain('MSCI World (IWDA)');
    expect(names).toContain('Johnson & Johnson');
  });

  it('reconoce el símbolo € como divisa', () => {
    const world = portfolio.positions.find((p) => p.name === 'MSCI World (IWDA)');
    expect(world?.currency).toBe('EUR');
  });

  it('avisa de que el documento parece un plan de aportación periódica', () => {
    expect(portfolio.extractionWarnings.some((w) => w.includes('aportación periódica'))).toBe(true);
  });
});
