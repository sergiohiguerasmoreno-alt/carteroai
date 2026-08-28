'use client';

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CATEGORICAL, CHROME } from './palette';
import type { ReturnPoint } from '@/lib/types';

interface Props {
  series: ReturnPoint[];
  benchmarkName: string;
}

export function ReturnComparisonChart({ series, benchmarkName }: Props) {
  if (series.length === 0) {
    return <p className="text-sm text-ink-400">No hay histórico suficiente para mostrar la rentabilidad por periodos.</p>;
  }

  return (
    <div style={{ width: '100%', height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={series} margin={{ top: 8, right: 8, left: -12, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke={CHROME.gridline} />
          <XAxis dataKey="periodLabel" tick={{ fontSize: 12, fill: CHROME.textSecondary }} axisLine={{ stroke: CHROME.axis }} tickLine={false} />
          <YAxis tick={{ fontSize: 12, fill: CHROME.textSecondary }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} width={44} />
          <Tooltip
            formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, name]}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${CHROME.gridline}` }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="portfolioReturnPct" name="Tu cartera" fill={CATEGORICAL[0]} radius={[3, 3, 0, 0]} maxBarSize={22} isAnimationActive={false} />
          <Bar dataKey="benchmarkReturnPct" name={benchmarkName} fill={CATEGORICAL[1]} radius={[3, 3, 0, 0]} maxBarSize={22} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
