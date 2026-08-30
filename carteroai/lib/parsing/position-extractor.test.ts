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
  it('clasifica una posición de materias primas como commodity, no como empresa ni como ETF de renta variable', () => {
    const text = 'Materias primas (oro físico)  5%  15 €/mes';
    const portfolio = extractPositionsFromText(text, 'plan.pdf');
    expect(portfolio.positions[0]?.assetClass).toBe('commodity');
  });

  it('clasifica como commodity un ETC físico aunque su nombre incluya "ETC"', () => {
    // COMMODITY_HINTS se comprueba antes que ETF_HINTS a propósito: sin eso,
    // "iShares Physical Gold ETC" caería en el genérico 'etf' por llevar
    // "ETC" en el nombre, en vez de en la categoría específica 'commodity'.
    const text = 'iShares Physical Gold ETC 5%';
    const portfolio = extractPositionsFromText(text, 'plan.pdf');
    expect(portfolio.positions[0]?.assetClass).toBe('commodity');
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

describe('extractPositionsFromText — recuperación de nombre en formato "tarjeta" (nombre y datos en líneas distintas)', () => {
  // Patrón habitual en documentos tipo infografía: el nombre completo del
  // instrumento va en su propia línea (sin datos), y la línea siguiente trae
  // solo el ticker + peso + descripción. Sin recuperar el nombre, la
  // posición queda con el ticker suelto como único nombre.
  it('recupera el nombre completo de la línea anterior cuando la fila de datos solo trae el ticker', () => {
    const text = ['Compañía Genérica Global', 'CGG  3%'].join('\n');
    const portfolio = extractPositionsFromText(text, 'plan.pdf');
    expect(portfolio.positions[0]?.name).toBe('Compañía Genérica Global');
    expect(portfolio.positions[0]?.ticker).toBe('CGG');
    expect(portfolio.positions[0]?.weightAsStated).toBeCloseTo(0.03);
  });

  it('reclasifica con el nombre recuperado cuando cambia la clase de activo (p.ej. un ETC de materias primas)', () => {
    const text = ['iShares Physical Silver ETC', 'ISLN  4%'].join('\n');
    const portfolio = extractPositionsFromText(text, 'plan.pdf');
    expect(portfolio.positions[0]?.name).toBe('iShares Physical Silver ETC');
    expect(portfolio.positions[0]?.assetClass).toBe('commodity');
  });

  it('no recupera el nombre si la línea anterior es una cabecera de sección, no un nombre huérfano', () => {
    const text = ['TECNOLOGÍA — 2 EMPRESAS · 4%', 'CGG  4%'].join('\n');
    const portfolio = extractPositionsFromText(text, 'plan.pdf');
    const cgg = portfolio.positions.find((p) => p.ticker === 'CGG');
    expect(cgg?.name).toBe('CGG');
  });

  it('no recupera el nombre si la línea anterior ya es, ella misma, otra posición con datos propios', () => {
    const text = ['Otra Posición  1%', 'CGG  4%'].join('\n');
    const portfolio = extractPositionsFromText(text, 'plan.pdf');
    const cgg = portfolio.positions.find((p) => p.ticker === 'CGG');
    expect(cgg?.name).toBe('CGG');
  });
});

describe('extractPositionsFromText — fragmentos duplicados de la misma posición (resumen + detalle)', () => {
  it('descarta un fragmento de ticker suelto cuyo peso coincide con una posición ya capturada que lo menciona en su nombre', () => {
    // "MSCI World (IWDA)" ya capturada arriba con peso 34%; un fragmento
    // posterior "IWDA  34%" del detalle de la misma tarjeta es la MISMA
    // posición, no una nueva.
    const text = ['MSCI World (IWDA)  34%  102 €/mes', 'Otro texto', 'IWDA  34%', 'algo más'].join('\n');
    const portfolio = extractPositionsFromText(text, 'plan.pdf');
    expect(portfolio.positions.filter((p) => p.name.includes('IWDA') || p.name === 'IWDA')).toHaveLength(1);
  });

  it('descarta un segundo fragmento de materia prima con el mismo peso aunque su nombre no comparta texto con el primero', () => {
    // El ticker del fragmento ("IGLN") no aparece dentro de "Materias
    // primas": el enlace es que ambos son 'commodity' con el mismo peso
    // declarado, señal de que es la misma posición descrita dos veces.
    const text = ['Materias primas  7.75%  23.25 €/mes', 'iShares Physical Gold ETC', 'IGLN  7.75%'].join('\n');
    const portfolio = extractPositionsFromText(text, 'plan.pdf');
    const commodities = portfolio.positions.filter((p) => p.assetClass === 'commodity');
    expect(commodities).toHaveLength(1);
  });

  it('NO descarta dos posiciones distintas solo porque coincidan en peso declarado', () => {
    // Guardarraíl: dos acciones distintas con el mismo peso (p.ej. una
    // cartera equiponderada) son posiciones reales diferentes, no
    // duplicados — deduplicar solo por peso sería un fallo grave y general.
    const text = ['Compañía Uno  2%', 'Compañía Dos  2%'].join('\n');
    const portfolio = extractPositionsFromText(text, 'plan.pdf');
    expect(portfolio.positions.map((p) => p.name)).toEqual(expect.arrayContaining(['Compañía Uno', 'Compañía Dos']));
    expect(portfolio.positions).toHaveLength(2);
  });
});

describe('extractPositionsFromText — números pegados a un nombre de producto', () => {
  it('no interpreta un número pegado a una palabra (p.ej. "GLP-1") como una cantidad o ticker', () => {
    // Bug real: "GLP-1" se leía como el número "-1" (marketValue = -1) y como
    // ticker "GLP", en vez de quedarse como parte del nombre del producto.
    const text = 'Fabricante Farma (Tratamiento GLP-1 líder) 2%';
    const portfolio = extractPositionsFromText(text, 'plan.pdf');
    expect(portfolio.positions).toHaveLength(1);
    expect(portfolio.positions[0]?.marketValue).toBeUndefined();
    expect(portfolio.positions[0]?.ticker).not.toBe('GLP');
    expect(portfolio.positions[0]?.weightAsStated).toBeCloseTo(0.02);
  });
});

describe('extractPositionsFromText — filas con "·" que sí son una posición real (maquetación en tarjetas)', () => {
  it('conserva una fila con descripción y peso propio aunque contenga "·"', () => {
    const text = 'CGG Fabricante genérico · líder de su sector 3%';
    const portfolio = extractPositionsFromText(text, 'plan.pdf');
    expect(portfolio.positions.some((p) => p.weightAsStated !== undefined && Math.abs(p.weightAsStated - 0.03) < 0.001)).toBe(true);
  });

  it('sigue descartando una cabecera de sección con "·" y peso propio, aunque no termine justo en el peso', () => {
    const text = 'SALUD — 3 EMPRESAS · 5.5%';
    const portfolio = extractPositionsFromText(text, 'plan.pdf');
    expect(portfolio.positions).toHaveLength(0);
  });
});

describe('extractPositionsFromText — nombre real de una sola palabra en mayúsculas (marca estilizada)', () => {
  // Bug real: una marca real cuyo logo/nombre viene siempre en mayúsculas
  // (p.ej. "NVIDIA") y en una sola palabra se confundía con una cabecera de
  // sección (que en este tipo de documento SIEMPRE es una frase de 2+
  // palabras, como "NÚCLEO PASIVO" o "TECNOLOGÍA — 5 EMPRESAS"), y la
  // posición se descartaba por completo aunque trajera su propio peso.
  it('conserva una posición cuyo nombre es una sola palabra en mayúsculas con descripción y peso propio', () => {
    const text = 'NVIDIA 1.5% 4.50 €/mes NVDA GPU líder IA · arquitectura CUDA · centros de datos + robótica · yield ~0.03%';
    const portfolio = extractPositionsFromText(text, 'plan.pdf');
    expect(portfolio.positions).toHaveLength(1);
    expect(portfolio.positions[0]?.name).toBe('NVIDIA');
    expect(portfolio.positions[0]?.weightAsStated).toBeCloseTo(0.015);
  });

  it('sigue descartando una cabecera de sección de 2+ palabras en mayúsculas aunque no mencione "EMPRESA"', () => {
    const text = 'NÚCLEO PASIVO — 51% · 153 €/MES';
    const portfolio = extractPositionsFromText(text, 'plan.pdf');
    expect(portfolio.positions).toHaveLength(0);
  });

  it('recupera un nombre de una sola palabra en mayúsculas como nombre huérfano de la línea anterior', () => {
    const text = ['NVIDIA', 'NVDA  1.5%'].join('\n');
    const portfolio = extractPositionsFromText(text, 'plan.pdf');
    expect(portfolio.positions[0]?.name).toBe('NVIDIA');
    expect(portfolio.positions[0]?.ticker).toBe('NVDA');
  });
});

describe('extractPositionsFromText — importe real vs. número descriptivo suelto (año, nº de años) en tarjetas', () => {
  // Bug real: una tarjeta con "·" a veces trae, junto al importe real en
  // €/mes, otro número suelto en la descripción (un año, un "N años subiendo
  // dividendo"...) que no es una cifra económica. La heurística de "el mayor
  // de los dos números es el valor de mercado" tomaba ese número descriptivo
  // como si fuera el importe, disparando el valor de la posición muy por
  // encima del resto (p.ej. "82% de la cartera" en vez de su ~1.5% real).
  it('usa el importe adyacente a la divisa como marketValue, no un año suelto en la descripción', () => {
    const text = 'Alphabet (Google) 1.5% 4.50 €/mes GOOGL Search + GCP + Gemini · dividendo iniciado 2024 · yield ~0.5%';
    const portfolio = extractPositionsFromText(text, 'plan.pdf');
    expect(portfolio.positions).toHaveLength(1);
    expect(portfolio.positions[0]?.marketValue).toBeCloseTo(4.5);
  });

  it('usa el importe adyacente a la divisa como marketValue, no un "N años" suelto en la descripción', () => {
    const text = 'Johnson & Johnson 2% 6 €/mes JNJ Rating AAA · 61 años subiendo dividendo · oncología e inmunología · yield ~3.1%';
    const portfolio = extractPositionsFromText(text, 'plan.pdf');
    expect(portfolio.positions).toHaveLength(1);
    expect(portfolio.positions[0]?.marketValue).toBeCloseTo(6);
    expect(portfolio.positions[0]?.quantity).toBeUndefined();
  });

  it('sigue usando ambos números si ninguno es adyacente a una divisa (sin señal para distinguir, no se pierde información)', () => {
    const text = 'Fondo Genérico 3% · 10 15';
    const portfolio = extractPositionsFromText(text, 'plan.pdf');
    expect(portfolio.positions).toHaveLength(1);
    expect(portfolio.positions[0]?.marketValue).toBeCloseTo(15);
    expect(portfolio.positions[0]?.quantity).toBeCloseTo(10);
  });
});

describe('extractPositionsFromText — ISIN como primera columna (formato habitual de extracto bancario)', () => {
  // Bug real: muchos extractos bancarios listan el ISIN ANTES del nombre
  // ("LU0908500753  Amundi MSCI World UCITS ETF  120  28,50  3.420,00"), al
  // revés que el formato ya cubierto arriba (nombre, luego ISIN). Cortar el
  // nombre en la posición del ISIN dejaba el nombre vacío y la posición
  // entera se descartaba — una cartera entera en este formato daba 0
  // posiciones.
  it('extrae nombre, cantidad, precio y valor cuando el ISIN va antes del nombre', () => {
    const text = 'LU0908500753  Amundi MSCI World UCITS ETF  120  28,50 €  3.420,00 €';
    const portfolio = extractPositionsFromText(text, 'extracto.pdf');
    expect(portfolio.positions).toHaveLength(1);
    const p = portfolio.positions[0]!;
    expect(p.name).toBe('Amundi MSCI World UCITS ETF');
    expect(p.isin).toBe('LU0908500753');
    expect(p.quantity).toBeCloseTo(120);
    expect(p.price).toBeCloseTo(28.5);
    expect(p.marketValue).toBeCloseTo(3420);
  });

  it('extrae varias posiciones con ISIN inicial y sin ticker en una cartera de solo fondos', () => {
    const text = ['LU1781541179  Fundsmith Equity Fund  25.0%', 'ES0138261018  Cobas Internacional FI  10.0%'].join('\n');
    const portfolio = extractPositionsFromText(text, 'extracto.pdf');
    expect(portfolio.positions).toHaveLength(2);
    expect(portfolio.positions.map((p) => p.name)).toEqual(['Fundsmith Equity Fund', 'Cobas Internacional FI']);
  });

  it('usa el ISIN como nombre provisional si la línea no trae ningún texto descriptivo propio', () => {
    const text = 'LU0908500753 120 28,50 3.420,00';
    const portfolio = extractPositionsFromText(text, 'extracto.pdf');
    expect(portfolio.positions).toHaveLength(1);
    expect(portfolio.positions[0]?.name).toBe('LU0908500753');
  });
});

describe('extractPositionsFromText — tarjeta de "resumen" y de "detalle" de la misma posición (evitar duplicados)', () => {
  // Caso real observado: algunos documentos "tarjeta" describen la misma
  // posición dos veces con nombres distintos — una vez en un resumen
  // compacto ("MSCI World (IWDA) 34% 102 €/mes") y otra vez en una tarjeta
  // de detalle con el nombre completo del fondo subyacente y una
  // descripción de sus características ("iShares Core MSCI World (Acc) 34%
  // 102 €/mes IWDA 1.600+ empresas · 23 países desarrollados · TER 0,20%").
  // La tarjeta de detalle, al mencionar cuántas empresas contiene el fondo,
  // se descarta igual que una cabecera de sección para no contar la misma
  // posición dos veces (lo que dispararía el peso total muy por encima del
  // 100%). Nótese que esto es deliberadamente conservador: una posición
  // real cuyo propio nombre contuviera la palabra "empresa" también se
  // descartaría por esta misma regla — se prioriza no duplicar posiciones
  // reales frente a admitir ese nombre concreto, mucho menos frecuente.
  it('no genera una posición duplicada a partir de la tarjeta de detalle de un fondo ya capturado en el resumen', () => {
    const text = [
      'MSCI World (IWDA) 34% 102 €/mes',
      'iShares Core MSCI World (Acc) 34% 102 €/mes IWDA 1.600+ empresas · 23 países desarrollados · TER 0,20%',
    ].join('\n');
    const portfolio = extractPositionsFromText(text, 'plan.pdf');
    expect(portfolio.positions).toHaveLength(1);
    expect(portfolio.positions[0]?.name).toBe('MSCI World (IWDA)');
  });

  it('sigue descartando una cabecera de sección real con el patrón "<número> EMPRESAS"', () => {
    const text = 'TECNOLOGÍA — 5 EMPRESAS · 10%';
    const portfolio = extractPositionsFromText(text, 'plan.pdf');
    expect(portfolio.positions).toHaveLength(0);
  });
});

describe('extractPositionsFromText — nombres de índice con número que no debe leerse como cifra económica', () => {
  // Bug real: "Euro Stoxx 50" es uno de los índices de referencia más
  // conocidos para un inversor europeo, pero no estaba en la lista de
  // nombres protegidos: su "50" se leía como el inicio de las columnas de
  // datos económicos, truncando el nombre y colando un "50" como valor de
  // mercado inventado.
  it('no trunca el nombre ni inventa un valor de mercado a partir del "50" de "Eurostoxx 50"', () => {
    const text = 'Fondo Naranja Eurostoxx 50 12.5%';
    const portfolio = extractPositionsFromText(text, 'plan.pdf');
    expect(portfolio.positions).toHaveLength(1);
    expect(portfolio.positions[0]?.name).toBe('Fondo Naranja Eurostoxx 50');
    expect(portfolio.positions[0]?.marketValue).toBeUndefined();
  });
});
