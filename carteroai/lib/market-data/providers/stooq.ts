import 'server-only';
import type { PriceHistory, PricePoint, QuoteSnapshot, SourceRef } from '@/lib/types';
import { fetchText } from '../http';

/**
 * Stooq no requiere clave de API. Se usa como fuente por defecto de precios
 * históricos diarios (para volatilidad, drawdown y rentabilidad). Cobertura
 * amplia de acciones y ETFs de EE.UU./Europa, pero limitada para muchos
 * fondos/ETFs UCITS solo identificados por ISIN: en esos casos no habrá
 * histórico disponible y se indicará explícitamente.
 */
function normalizeSymbol(symbol: string): string {
  const s = symbol.trim().toLowerCase();
  if (s.includes('.')) return s;
  // Heurística simple: tickers de hasta 5 letras sin sufijo se asumen EE.UU.
  return `${s}.us`;
}

function buildSource(url: string, fields: string[]): SourceRef {
  return { provider: 'Stooq', url, retrievedAt: new Date().toISOString(), fieldsUsed: fields };
}

export async function getStooqHistory(symbol: string): Promise<PriceHistory | undefined> {
  const norm = normalizeSymbol(symbol);
  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(norm)}&i=d`;
  const csv = await fetchText(url);
  if (!csv || csv.startsWith('N/D') || !csv.includes(',')) return undefined;

  const lines = csv.trim().split('\n');
  if (lines.length < 2) return undefined;
  const header = lines[0]!.toLowerCase();
  if (!header.includes('date') || !header.includes('close')) return undefined;

  const points: PricePoint[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i]!.split(',');
    if (cols.length < 5) continue;
    const date = cols[0]!;
    const close = Number(cols[4]);
    if (date && Number.isFinite(close) && close > 0) points.push({ date, close });
  }
  if (points.length === 0) return undefined;

  return {
    symbol: norm,
    points,
    source: buildSource(url, ['date', 'close']),
  };
}

export async function getStooqQuote(symbol: string): Promise<QuoteSnapshot | undefined> {
  const history = await getStooqHistory(symbol);
  if (!history || history.points.length === 0) return undefined;
  const last = history.points[history.points.length - 1]!;
  return {
    symbol: history.symbol,
    price: last.close,
    asOf: last.date,
    source: buildSource(history.source.url ?? '', ['close']),
  };
}
