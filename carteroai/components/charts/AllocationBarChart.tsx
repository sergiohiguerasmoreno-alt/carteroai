'use client';

import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CATEGORICAL, CHROME, foldToTop, type Slice } from './palette';

interface Props {
  data: Slice[];
  maxSlices?: number;
  heightPerRow?: number;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: Slice }[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0]!.payload;
  return (
    <div className="rounded-md border border-ink-100 bg-white px-3 py-2 text-xs shadow-card">
      <p className="font-medium text-ink-950">{p.label}</p>
      <p className="text-ink-500">{(p.weightPct * 100).toFixed(1)}% de la cartera</p>
    </div>
  );
}

export function AllocationBarChart({ data, maxSlices = 7, heightPerRow = 34 }: Props) {
  const folded = foldToTop(data, maxSlices);
  if (folded.length === 0) {
    return <p className="text-sm text-ink-400">Sin datos suficientes para mostrar este desglose.</p>;
  }
  const height = Math.max(80, folded.length * heightPerRow);

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={folded} layout="vertical" margin={{ top: 4, right: 48, left: 4, bottom: 4 }}>
          <XAxis type="number" hide domain={[0, (max: number) => Math.max(max * 1.15, 0.05)]} />
          <YAxis
            type="category"
            dataKey="label"
            width={140}
            tick={{ fontSize: 12, fill: CHROME.textSecondary }}
            axisLine={{ stroke: CHROME.gridline }}
            tickLine={false}
          />
          <Tooltip cursor={{ fill: 'rgba(11,15,20,0.03)' }} content={<CustomTooltip />} />
          <Bar dataKey="weightPct" radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={false}>
            {folded.map((entry, i) => (
              <Cell key={entry.label} fill={entry.label === 'Otros' ? CHROME.muted : CATEGORICAL[i % CATEGORICAL.length]} />
            ))}
            <LabelList
              dataKey="weightPct"
              position="right"
              formatter={(v: number) => `${(v * 100).toFixed(1)}%`}
              style={{ fill: CHROME.textPrimary, fontSize: 12, fontWeight: 500 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
