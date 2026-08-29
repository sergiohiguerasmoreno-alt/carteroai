function scoreColor(v: number): string {
  if (v >= 70) return 'text-signal-teal';
  if (v >= 50) return 'text-signal-amber';
  return 'text-signal-rose';
}

export function ScoreTile({ label, value, big = false, hint }: { label: string; value: number; big?: boolean; hint?: string }) {
  return (
    <div className="card p-4">
      <p className="label-sm mb-1">{label}</p>
      <p className={`font-serif ${big ? 'text-5xl' : 'text-3xl'} ${scoreColor(value)}`}>{value}</p>
      <p className="text-xs text-ink-400">/100</p>
      {hint && <p className="mt-1 text-xs leading-snug text-ink-500">{hint}</p>}
    </div>
  );
}
