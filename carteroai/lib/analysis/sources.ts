import type { MarketDataBundle, SourceRef } from '@/lib/types';

export function collectSources(bundles: MarketDataBundle[], extra: (SourceRef | undefined)[]): SourceRef[] {
  const all: SourceRef[] = [];
  for (const b of bundles) {
    if (b.history?.source) all.push(b.history.source);
    if (b.fundamentals?.source) all.push(b.fundamentals.source);
    if (b.etf?.source) all.push(b.etf.source);
  }
  for (const e of extra) if (e) all.push(e);

  const seen = new Map<string, SourceRef>();
  for (const s of all) {
    const key = `${s.provider}::${s.url ?? ''}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, { ...s, fieldsUsed: [...s.fieldsUsed] });
    } else {
      existing.fieldsUsed = Array.from(new Set([...existing.fieldsUsed, ...s.fieldsUsed]));
    }
  }
  return Array.from(seen.values());
}

export function collectDataLimitations(bundles: MarketDataBundle[], extra: (string | undefined)[]): string[] {
  const all = new Set<string>();
  for (const b of bundles) for (const n of b.notes) all.add(n);
  for (const e of extra) if (e) all.add(e);
  return Array.from(all);
}
