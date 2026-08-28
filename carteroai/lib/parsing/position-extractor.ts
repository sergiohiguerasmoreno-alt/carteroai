import 'server-only';
import { nanoid } from 'nanoid';
import type { AssetClass, ExtractionConfidence, Portfolio, Position } from '@/lib/types';
import { parseLocalizedNumber } from './number-format';

const ISIN_RE = /\b[A-Z]{2}[0-9A-Z]{9}[0-9]\b/g;
const CURRENCY_CODES = ['EUR', 'USD', 'GBP', 'CHF', 'JPY', 'GBX', 'CAD', 'AUD', 'SEK', 'NOK', 'DKK'];
const CURRENCY_RE = new RegExp(`\\b(${CURRENCY_CODES.join('|')})\\b`);
const PERCENT_RE = /-?[0-9][0-9.,]*\s?%/g;
// Números con o sin separador de miles (p.ej. "10.248,00" o simplemente "1200").
// El primer grupo usa \d+ (no \d{1,3}) para no truncar enteros largos sin
// separadores; los grupos de miles adicionales y el decimal final son opcionales.
const NUMBER_RE = /-?\(?\d+(?:[.,]\d{3})*(?:[.,]\d+)?\)?/g;

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

const ETF_HINTS = ['ETF', 'UCITS', 'TRACKER', 'ISHARES', 'VANGUARD', 'XTRACKERS', 'SPDR', 'AMUNDI ETF', 'INVESCO'];
const FUND_HINTS = ['FONDO', 'FUND', 'SICAV', 'FI ', ' FI', 'PLAN DE PENSIONES', 'PENSION'];
const BOND_HINTS = ['BOND', 'OBLIGAC', 'BONO', 'TREASURY', 'LETRA', 'DEUDA'];
const CASH_HINTS = ['EFECTIVO', 'CASH', 'LIQUIDEZ', 'CUENTA CORRIENTE', 'CUENTA REMUNERADA'];
const CRYPTO_HINTS = ['BITCOIN', 'ETHEREUM', 'BTC', 'ETH', 'CRIPTO', 'CRYPTO'];

function classifyAsset(name: string, isin?: string): AssetClass {
  const upper = name.toUpperCase();
  if (CASH_HINTS.some((h) => upper.includes(h))) return 'cash';
  if (CRYPTO_HINTS.some((h) => upper.includes(h))) return 'crypto';
  if (BOND_HINTS.some((h) => upper.includes(h))) return 'bond';
  if (ETF_HINTS.some((h) => upper.includes(h))) return 'etf';
  if (FUND_HINTS.some((h) => upper.includes(h))) return 'fund';
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
  const isinMatch = line.match(ISIN_RE);
  const isin = isinMatch?.[0];

  const currencyMatch = line.match(CURRENCY_RE);
  const currency = currencyMatch?.[1];

  const percentMatches = line.match(PERCENT_RE) ?? [];
  const weight = percentMatches.length > 0 ? parseLocalizedNumber(percentMatches[0]!.replace('%', '')) : undefined;
  const weightPct = weight !== undefined ? weight / 100 : undefined;

  // Retiramos ISIN y porcentajes de la línea antes de buscar números "planos"
  // para no confundir dígitos del ISIN con cifras económicas.
  let stripped = line;
  if (isin) stripped = stripped.replace(isin, ' ');
  for (const p of percentMatches) stripped = stripped.replace(p, ' ');

  const numberMatches = stripped.match(NUMBER_RE) ?? [];
  const numbers = numberMatches
    .map((n) => parseLocalizedNumber(n))
    .filter((n): n is number => n !== undefined && Math.abs(n) > 0.0001);

  // El nombre es el texto antes del primer número/ISIN reconocido.
  const cutIndex = Math.min(
    isin ? line.indexOf(isin) : Infinity,
    numberMatches.length > 0 ? line.search(NUMBER_RE) : Infinity,
  );
  const rawNameCandidate = cleanName(Number.isFinite(cutIndex) ? line.slice(0, cutIndex) : line);
  const { name: nameCandidate, ticker } = extractTrailingTicker(rawNameCandidate);

  return { isin, currency, weight: weightPct, numbers, nameCandidate: nameCandidate || rawNameCandidate, ticker };
}

function buildPosition(line: string): Position | null {
  const t = tokenizeLine(line);
  const hasIsin = !!t.isin;
  const hasNumbers = t.numbers.length > 0;
  const hasWeight = t.weight !== undefined;

  if (!hasIsin && !hasNumbers && !hasWeight) return null;
  if (!t.nameCandidate || t.nameCandidate.length < 2) return null;
  // Descarta líneas que son claramente cabeceras/totales.
  const upperName = t.nameCandidate.toUpperCase();
  if (['TOTAL', 'SUBTOTAL', 'SALDO', 'TOTAL CARTERA', 'TOTAL PORTFOLIO'].some((h) => upperName === h || upperName.startsWith(h))) {
    return null;
  }

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
