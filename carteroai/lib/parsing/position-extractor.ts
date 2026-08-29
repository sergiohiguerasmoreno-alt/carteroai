import 'server-only';
import { nanoid } from 'nanoid';
import type { AssetClass, ExtractionConfidence, Portfolio, Position } from '@/lib/types';
import { parseLocalizedNumber } from './number-format';
import { findPositionTableLines } from '@/lib/ai/pdf-structure';

const ISIN_RE = /\b[A-Z]{2}[0-9A-Z]{9}[0-9]\b/g;
const CURRENCY_CODES = ['EUR', 'USD', 'GBP', 'CHF', 'JPY', 'GBX', 'CAD', 'AUD', 'SEK', 'NOK', 'DKK'];
const CURRENCY_RE = new RegExp(`\\b(${CURRENCY_CODES.join('|')})\\b`);
// Símbolos de divisa habituales cuando el documento no usa el código ISO.
const CURRENCY_SYMBOLS: Record<string, string> = { '€': 'EUR', '$': 'USD', '£': 'GBP' };
const PERCENT_RE = /-?[0-9][0-9.,]*\s?%/g;
// Cualificadores tras los que un porcentaje casi nunca es el peso de la
// posición en la cartera, sino una cifra descriptiva (rentabilidad histórica,
// coste del producto...). Confundirlos con el peso es una fuente frecuente de
// datos "inventados" en el informe.
const NON_WEIGHT_PERCENT_QUALIFIER_RE = /(?:yield|rentabilidad|ter)\s*~?\s*$/i;
// Números con o sin separador de miles (p.ej. "10.248,00" o simplemente "1200").
// El primer grupo usa \d+ (no \d{1,3}) para no truncar enteros largos sin
// separadores; los grupos de miles adicionales y el decimal final son opcionales.
const NUMBER_RE = /-?\(?\d+(?:[.,]\d{3})*(?:[.,]\d+)?\)?/g;
// Documentos con maquetación tipo "tarjeta"/infografía (varias columnas
// visuales reconstruidas en una sola línea de texto) suelen unir en una
// misma línea fragmentos descriptivos separados por "·". A diferencia de un
// extracto tabular real de bróker/banco, esas líneas no son filas de
// posición y, si se tratan como tales, generan posiciones inventadas a
// partir de frases sueltas (años, nº de empresas, rentabilidad...).
const DESCRIPTIVE_FRAGMENT_RE = /·/;
// Líneas de cabecera de sección/categoría ("NOMBRE — 51% · 153 €/MES") o de
// subtotal ("ETFs — 63.5%"): no son posiciones individuales.
const SECTION_SUBTOTAL_RE = /—\s*[\d.,]+\s*%\s*$/;
// Pie legal/de generación del documento (fecha de generación, aviso legal...).
const BOILERPLATE_RE = /asesoramiento financiero|^generado el\b/i;

// Palabras que NUNCA deben interpretarse como ticker aunque aparezcan en
// mayúsculas justo antes del ISIN/los números: sufijos societarios y
// términos descriptivos habituales de fondos/ETFs.
const TICKER_STOPLIST = new Set([
  'SE', 'AG', 'NV', 'SA', 'PLC', 'INC', 'CORP', 'LTD', 'CO', 'GMBH', 'SPA', 'ASA', 'OYJ', 'KGAA', 'SL', 'SAU',
  'ETF', 'UCITS', 'TRACKER', 'ISHARES', 'VANGUARD', 'XTRACKERS', 'SPDR', 'AMUNDI', 'INVESCO', 'FUND', 'FONDO',
  'FI', 'SICAV', 'CLASS', 'ACC', 'DIST', 'HEDGED', 'EUR', 'USD', 'GBP', 'CHF', 'JPY', 'TOTAL',
]);

function extractTrailingTicker(nameCandidate: string): { name: string; ticker?: string } {
  const words = nameCandidate.trim().split(/\s+/);
  const last = words[words.length - 1];
  if (last && /^[A-Z]{2,6}$/.test(last) && !TICKER_STOPLIST.has(last)) {
    return { name: words.slice(0, -1).join(' ').trim(), ticker: last };
  }
  return { name: nameCandidate };
}

const ETF_HINTS = ['ETF', 'ETC', 'ETP', 'UCITS', 'TRACKER', 'ISHARES', 'VANGUARD', 'XTRACKERS', 'SPDR', 'AMUNDI ETF', 'INVESCO'];
const FUND_HINTS = ['FONDO', 'FUND', 'SICAV', 'FI ', ' FI', 'PLAN DE PENSIONES', 'PENSION'];
const BOND_HINTS = ['BOND', 'OBLIGAC', 'BONO', 'TREASURY', 'LETRA', 'DEUDA'];
const CASH_HINTS = ['EFECTIVO', 'CASH', 'LIQUIDEZ', 'CUENTA CORRIENTE', 'CUENTA REMUNERADA'];
const CRYPTO_HINTS = ['BITCOIN', 'ETHEREUM', 'BTC', 'ETH', 'CRIPTO', 'CRYPTO'];
// Nombres de índices de referencia: en una cartera minorista, una posición
// llamada así (con o sin la marca del emisor) es casi siempre el ETF/fondo
// indexado que replica ese índice, nunca una empresa individual que cotice
// con ese nombre. Sin esta lista, "MSCI World (IWDA)" se clasificaba como
// una acción cualquiera, y el motor de reglas podía tratar un ETF
// globalmente diversificado como si fuera "una sola empresa" a efectos de
// riesgo de concentración.
const INDEX_HINTS = [
  'MSCI WORLD', 'MSCI EUROPE', 'MSCI EM', 'MSCI EMERGING', 'MSCI ACWI', 'ACWI',
  'S&P 500', 'S&P500', 'FTSE ALL-WORLD', 'FTSE ALL WORLD', 'FTSE 100', 'FTSE 250',
  'STOXX 600', 'EURO STOXX', 'NASDAQ 100', 'RUSSELL 2000', 'RUSSELL 1000',
  'NIKKEI 225', 'IBEX 35', 'CAC 40', 'DAX 40', 'TOPIX', 'EM IMI',
  'ALL COUNTRY WORLD', 'TOTAL WORLD STOCK', 'TOTAL STOCK MARKET', 'WORLD INDEX',
];
// Categorías de materias primas: en una cartera minorista, una posición
// descrita así es casi siempre un ETC/fondo respaldado por el activo físico
// (oro, plata...), nunca una empresa. Términos genéricos y no ambiguos
// solamente: se evita "ORO"/"GOLD"/"PLATA"/"SILVER" sueltos porque también
// son parte de nombres reales de empresas mineras (p.ej. "Gold Fields",
// "Barrick Gold"), que sí son una acción individual y deben tratarse como tal.
const COMMODITY_HINTS = [
  'MATERIAS PRIMAS', 'COMMODITIES', 'COMMODITY', 'METALES PRECIOSOS', 'PRECIOUS METALS',
  'ORO FÍSICO', 'ORO FISICO', 'PHYSICAL GOLD', 'PLATA FÍSICA', 'PLATA FISICA', 'PHYSICAL SILVER',
];

// Varios índices de referencia muy comunes incluyen un número en su propio
// nombre (S&P 500, FTSE 100, IBEX 35, NASDAQ 100...). Sin este enmascarado,
// el parser interpretaba ese número como el inicio de las columnas de datos
// económicos (cantidad/precio/valor) y cortaba el nombre de la posición por
// la mitad (p.ej. "S&P 500 (VUSA)" quedaba en solo "S&P"), además de colar
// ese número como si fuera una cifra económica real. Enmascaramos solo los
// dígitos que forman parte de estos nombres de índice conocidos, preservando
// la longitud del texto para no desplazar el resto de posiciones.
function maskProtectedIndexNumbers(text: string): string {
  let result = text;
  for (const hint of INDEX_HINTS) {
    if (!/\d/.test(hint)) continue;
    const escaped = hint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(escaped, 'gi');
    result = result.replace(re, (match) => match.replace(/\d/g, '#'));
  }
  return result;
}

function classifyAsset(name: string, isin?: string): AssetClass {
  const upper = name.toUpperCase();
  if (CASH_HINTS.some((h) => upper.includes(h))) return 'cash';
  if (CRYPTO_HINTS.some((h) => upper.includes(h))) return 'crypto';
  if (BOND_HINTS.some((h) => upper.includes(h))) return 'bond';
  if (ETF_HINTS.some((h) => upper.includes(h))) return 'etf';
  if (FUND_HINTS.some((h) => upper.includes(h))) return 'fund';
  if (INDEX_HINTS.some((h) => upper.includes(h))) return 'etf';
  if (COMMODITY_HINTS.some((h) => upper.includes(h))) return 'etf';
  // Prefijos ISIN típicos de UCITS domiciliados en Irlanda/Luxemburgo suelen
  // ser ETFs o fondos, pero es una señal débil: no decide por sí sola.
  if (isin && (isin.startsWith('IE00') || isin.startsWith('LU')) && name.split(' ').length <= 6) {
    return 'etf';
  }
  return 'equity';
}

function cleanName(raw: string): string {
  return raw
    .replace(/^\s*[\d.]+[)\-.]?\s*/, '') // numeración inicial tipo "1. " o "3) "
    .replace(/\s{2,}/g, ' ')
    .trim();
}

interface LineTokens {
  isin?: string;
  ticker?: string;
  currency?: string;
  weight?: number;
  numbers: number[];
  nameCandidate: string;
}

function tokenizeLine(line: string): LineTokens {
  // Enmascara los dígitos que forman parte de nombres de índice conocidos
  // (ver maskProtectedIndexNumbers) antes de buscar ISIN/porcentajes/números,
  // para que no se confundan con cifras económicas ni corten el nombre. El
  // texto enmascarado tiene la misma longitud que `line`, así que los índices
  // calculados sobre él siguen siendo válidos para recortar `line`.
  const masked = maskProtectedIndexNumbers(line);

  const isinMatch = masked.match(ISIN_RE);
  const isin = isinMatch?.[0];

  const currencyMatch = masked.match(CURRENCY_RE);
  let currency = currencyMatch?.[1];
  if (!currency) {
    for (const [symbol, code] of Object.entries(CURRENCY_SYMBOLS)) {
      if (masked.includes(symbol)) {
        currency = code;
        break;
      }
    }
  }

  // Usamos matchAll (en vez de match) para poder mirar el texto que precede a
  // cada porcentaje y descartar los que en realidad describen una
  // rentabilidad/coste, no el peso de la posición en la cartera.
  const percentMatches = Array.from(masked.matchAll(PERCENT_RE));
  const weightMatch = percentMatches.find((m) => !NON_WEIGHT_PERCENT_QUALIFIER_RE.test(masked.slice(0, m.index ?? 0)));
  const weight = weightMatch ? parseLocalizedNumber(weightMatch[0].replace('%', '')) : undefined;
  const weightPct = weight !== undefined ? weight / 100 : undefined;

  // Retiramos ISIN y porcentajes de la línea antes de buscar números "planos"
  // para no confundir dígitos del ISIN con cifras económicas.
  let stripped = masked;
  if (isin) stripped = stripped.replace(isin, ' ');
  for (const m of percentMatches) stripped = stripped.replace(m[0], ' ');

  const numberMatches = stripped.match(NUMBER_RE) ?? [];
  const numbers = numberMatches
    .map((n) => parseLocalizedNumber(n))
    .filter((n): n is number => n !== undefined && Math.abs(n) > 0.0001);

  // El nombre es el texto antes del primer número/ISIN/porcentaje reconocido
  // (si no se corta también en el porcentaje, líneas del tipo "TICKER  12%"
  // dejan el porcentaje pegado al nombre).
  const cutIndex = Math.min(
    isin ? masked.indexOf(isin) : Infinity,
    numberMatches.length > 0 ? masked.search(NUMBER_RE) : Infinity,
    percentMatches.length > 0 ? (percentMatches[0]!.index ?? Infinity) : Infinity,
  );
  const rawNameCandidate = cleanName(Number.isFinite(cutIndex) ? line.slice(0, cutIndex) : line);
  const { name: nameCandidate, ticker } = extractTrailingTicker(rawNameCandidate);

  return { isin, currency, weight: weightPct, numbers, nameCandidate: nameCandidate || rawNameCandidate, ticker };
}

function buildPosition(line: string): Position | null {
  // Descarta pie legal / fecha de generación del documento antes de tocar el
  // resto del texto: nunca es una posición y sus números (fechas, nº de
  // página...) no deben leerse como cifras económicas.
  if (BOILERPLATE_RE.test(line)) return null;

  const t = tokenizeLine(line);
  const hasIsin = !!t.isin;
  const hasNumbers = t.numbers.length > 0;
  const hasWeight = t.weight !== undefined;

  if (!hasIsin && !hasNumbers && !hasWeight) return null;
  if (!t.nameCandidate || t.nameCandidate.length < 2) return null;

  // Sin ISIN, una línea que mezcla varios fragmentos separados por "·" casi
  // siempre es texto descriptivo (maquetación en tarjetas/infografía con
  // varias columnas reconstruidas en una sola línea), no una fila de
  // posición: tratarla como tal es la causa más habitual de posiciones
  // inventadas a partir de una frase suelta (años, nº de empresas...).
  if (!hasIsin && DESCRIPTIVE_FRAGMENT_RE.test(line)) return null;

  // Descarta líneas que son claramente cabeceras/totales.
  const upperName = t.nameCandidate.toUpperCase();
  if (['TOTAL', 'SUBTOTAL', 'SALDO', 'TOTAL CARTERA', 'TOTAL PORTFOLIO'].some((h) => upperName === h || upperName.startsWith(h))) {
    return null;
  }
  // Cabeceras de sección/subtotal del tipo "Nombre — 63.5%": un porcentaje
  // suelto tras un guion largo, sin ningún importe, describe un grupo de
  // posiciones, no una posición individual.
  if (!hasIsin && SECTION_SUBTOTAL_RE.test(line)) return null;

  let quantity: number | undefined;
  let price: number | undefined;
  let marketValue: number | undefined;

  const nums = [...t.numbers];
  if (nums.length >= 4) {
    // Escenario típico: cantidad, precio, [precio medio], valor
    [quantity, price] = nums;
    marketValue = nums[nums.length - 1];
  } else if (nums.length === 3) {
    [quantity, price, marketValue] = nums;
  } else if (nums.length === 2) {
    // Ambiguo entre (cantidad, valor) y (precio, valor). Asumimos que el
    // mayor de los dos, si es claramente mayor, es el valor de mercado.
    const [a, b] = nums as [number, number];
    marketValue = Math.max(a, b);
    const other = Math.min(a, b);
    quantity = Number.isInteger(other) ? other : undefined;
    if (quantity === undefined) price = other;
  } else if (nums.length === 1) {
    marketValue = nums[0];
  }

  let confidence: ExtractionConfidence;
  if (hasIsin && marketValue !== undefined && (hasWeight || (quantity !== undefined && price !== undefined))) {
    confidence = 'high';
  } else if (hasIsin || (marketValue !== undefined && hasWeight)) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  const assetClass = classifyAsset(t.nameCandidate, t.isin);

  const position: Position = {
    id: nanoid(10),
    rawLine: line.trim(),
    name: t.nameCandidate,
    isin: t.isin,
    ticker: t.ticker,
    assetClass,
    quantity,
    price,
    currency: t.currency,
    marketValue,
    weightAsStated: t.weight,
    extractionConfidence: confidence,
    userConfirmed: false,
    userEdited: false,
  };
  return position;
}

function detectBaseCurrency(positions: Position[]): string {
  const counts = new Map<string, number>();
  for (const p of positions) {
    if (p.currency) counts.set(p.currency, (counts.get(p.currency) ?? 0) + 1);
  }
  let best = 'EUR';
  let bestCount = 0;
  for (const [ccy, count] of counts) {
    if (count > bestCount) {
      best = ccy;
      bestCount = count;
    }
  }
  return best;
}

export function extractPositionsFromText(text: string, sourceFileName: string): Portfolio {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const candidates: Position[] = [];
  for (const line of lines) {
    const pos = buildPosition(line);
    if (pos) candidates.push(pos);
  }

  // Filtra falsos positivos evidentes: nombres puramente numéricos o de una
  // sola letra, o duplicados exactos consecutivos (cabecera repetida).
  const positions = candidates.filter((p) => /[A-Za-zÁÉÍÓÚÑáéíóúñ]{2,}/.test(p.name));

  const warnings: string[] = [];
  if (positions.length === 0) {
    warnings.push(
      'No se han podido identificar posiciones automáticamente en este PDF. Es posible que el documento sea una imagen escaneada o tenga un formato no tabular. Prueba con otro archivo.',
    );
  }

  // Detecta documentos que describen un plan de aportación periódica (p.ej.
  // "102 €/mes" repetido junto a cada posición) en vez de un extracto con el
  // valor de mercado actual de la cartera. Interpretar esos importes como
  // valor de posición da una cifra de cartera sin sentido, así que avisamos
  // explícitamente en vez de dejar que el informe lo dé por bueno en silencio.
  const monthlyAmountMentions = (text.match(/\/\s*mes\b/gi) ?? []).length;
  if (monthlyAmountMentions >= 3) {
    warnings.push(
      'Este PDF parece describir un plan de aportación periódica (importes en €/mes junto a cada posición), no el valor de mercado actual de tu cartera. Los importes económicos del informe pueden no representar el valor real de cada posición: interprétalos con cautela.',
    );
  }

  const lowConfidenceCount = positions.filter((p) => p.extractionConfidence === 'low').length;
  if (lowConfidenceCount > 0) {
    warnings.push(
      `${lowConfidenceCount} posición(es) se han extraído con confianza baja. Se indicarán en el informe final para que las verifiques con tu extracto original.`,
    );
  }

  const withWeight = positions.filter((p) => p.weightAsStated !== undefined);
  if (withWeight.length >= Math.max(2, positions.length - 1)) {
    const sum = withWeight.reduce((acc, p) => acc + (p.weightAsStated ?? 0), 0);
    if (sum < 0.9 || sum > 1.1) {
      warnings.push(
        `Los pesos detectados en el PDF suman ${(sum * 100).toFixed(1)}% en lugar de 100%. Revisa las posiciones: puede haber líneas mal interpretadas.`,
      );
    }
  }

  return {
    id: nanoid(12),
    positions,
    baseCurrency: detectBaseCurrency(positions),
    sourceFileName,
    extractedAt: new Date().toISOString(),
    extractionWarnings: warnings,
  };
}

function lowConfidenceRatio(p: Portfolio): number {
  if (p.positions.length === 0) return 1;
  return p.positions.filter((x) => x.extractionConfidence === 'low').length / p.positions.length;
}

/** Compara dos extracciones del mismo documento y decide cuál es más fiable. */
function isBetterExtraction(candidate: Portfolio, baseline: Portfolio): boolean {
  if (candidate.positions.length === 0) return false;
  if (baseline.positions.length === 0) return true;
  const candidateLow = lowConfidenceRatio(candidate);
  const baselineLow = lowConfidenceRatio(baseline);
  if (candidateLow !== baselineLow) return candidateLow < baselineLow;
  return candidate.positions.length > baseline.positions.length;
}

/**
 * Igual que extractPositionsFromText, pero si hay IA configurada, primero le
 * pide que localice en qué líneas del documento está la tabla de posiciones
 * (documentos con varias cuentas, texto legal mezclado con la tabla, formatos
 * poco habituales...). La IA solo indica NÚMEROS DE LÍNEA; los datos de cada
 * posición se siguen extrayendo siempre del texto literal con el mismo
 * parser determinista de arriba, exactamente igual que si la IA no hubiera
 * intervenido. Si la IA no está disponible, falla, o el resultado no mejora
 * la extracción sobre el texto completo, se usa esta última sin cambios.
 */
export async function extractPositionsSmart(text: string, sourceFileName: string): Promise<Portfolio> {
  const baseline = extractPositionsFromText(text, sourceFileName);

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const ranges = await findPositionTableLines(lines).catch(() => null);
  if (!ranges) return baseline;

  const focusedLines = ranges.flatMap((r) => lines.slice(r.start, r.end + 1));
  if (focusedLines.length === 0) return baseline;

  const focused = extractPositionsFromText(focusedLines.join('\n'), sourceFileName);
  if (!isBetterExtraction(focused, baseline)) return baseline;

  return {
    ...focused,
    extractionWarnings: [
      ...focused.extractionWarnings,
      'Se ha usado IA para ayudar a localizar la tabla de posiciones dentro del documento. Los datos de cada posición se han leído directamente del texto del PDF, nunca generados por la IA.',
    ],
  };
}
