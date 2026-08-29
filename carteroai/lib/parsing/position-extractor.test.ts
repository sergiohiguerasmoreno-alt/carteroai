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

  it('clasifica un ETF nombrado por su índice de referencia como ETF, no como empresa', () => {
    // Bug real reportado: sin esto, el motor de reglas trataba "MSCI World
    // (IWDA)" como si fuera una única empresa y recomendaba "reducir el peso
    // de una sola empresa" sobre un ETF globalmente diversificado.
    const world = portfolio.positions.find((p) => p.name === 'MSCI World (IWDA)');
    expect(world?.assetClass).toBe('etf');
  });
});

describe('extractPositionsFromText — ETFs nombrados por su índice de referencia', () => {
  it('clasifica como ETF aunque no lleve marca de emisor en el nombre', () => {
    const text = [
      'MSCI World (IWDA)  34%  102 €/mes',
      'MSCI Europe (IMEU)  17%  51 €/mes',
      'MSCI EM (EIMI)  12.5%  37.50 €/mes',
      'S&P 500 (VUSA)  10%  30 €/mes',
      'FTSE All-World (VWRL)  10%  30 €/mes',
    ].join('\n');
    const portfolio = extractPositionsFromText(text, 'plan.pdf');
    const byName = new Map(portfolio.positions.map((p) => [p.name, p.assetClass]));
    expect(byName.get('MSCI World (IWDA)')).toBe('etf');
    expect(byName.get('MSCI Europe (IMEU)')).toBe('etf');
    expect(byName.get('MSCI EM (EIMI)')).toBe('etf');
    expect(byName.get('S&P 500 (VUSA)')).toBe('etf');
    expect(byName.get('FTSE All-World (VWRL)')).toBe('etf');
  });

  it('sigue clasificando como equity una acción individual normal', () => {
    const text = ['Johnson & Johnson 2%', 'NVDA  1.5%'].join('\n');
    const portfolio = extractPositionsFromText(text, 'plan.pdf');
    const byName = new Map(portfolio.positions.map((p) => [p.name, p.assetClass]));
    expect(byName.get('Johnson & Johnson')).toBe('equity');
    expect(byName.get('NVDA')).toBe('equity');
  });

  it('no trunca el nombre de un índice que incluye un número (p.ej. "S&P 500")', () => {
    // Bug relacionado: antes de proteger estos números, "S&P 500 (VUSA)" se
    // cortaba en "S&P" (el "500" se interpretaba como el inicio de las
    // columnas de datos económicos) y además colaba un 500 como si fuera una
    // cifra real de cantidad/precio.
    const text = 'S&P 500 (VUSA)  10%  30 €/mes';
    const portfolio = extractPositionsFromText(text, 'plan.pdf');
    expect(portfolio.positions[0]?.name).toBe('S&P 500 (VUSA)');
    expect(portfolio.positions[0]?.weightAsStated).toBeCloseTo(0.1);
  });
});

describe('extractPositionsFromText — materias primas (ETC de oro/plata)', () => {
  it('clasifica como ETF/ETC una posición de materias primas, no como empresa', () => {
    const text = 'Materias primas (oro físico)  5%  15 €/mes';
    const portfolio = extractPositionsFromText(text, 'plan.pdf');
    expect(portfolio.positions[0]?.assetClass).toBe('etf');
  });

  it('no clasifica como materia prima una minera individual que lleve "Gold" en el nombre', () => {
    // Guardarraíl deliberado: "Barrick Gold" o "Gold Fields" son empresas
    // mineras reales, no un ETC de oro físico. Por eso COMMODITY_HINTS no usa
    // "ORO"/"GOLD" sueltos, y esta posición debe seguir siendo una acción.
    const text = 'Barrick Gold 3%';
    const portfolio = extractPositionsFromText(text, 'plan.pdf');
    expect(portfolio.positions[0]?.assetClass).toBe('equity');
  });
});
