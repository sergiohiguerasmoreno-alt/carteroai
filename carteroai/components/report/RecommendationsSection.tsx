'use client';

import { useState } from 'react';
import type { Recommendation, RecommendationCategory } from '@/lib/types';
import { Section } from './Section';

const CATEGORY_META: Record<RecommendationCategory, { label: string; badge: string; order: number }> = {
  change: { label: 'Cambiar', badge: 'bg-signal-rose/10 text-signal-rose', order: 0 },
  remove: { label: 'Eliminar', badge: 'bg-signal-rose/15 text-signal-rose', order: 1 },
  review: { label: 'Revisar', badge: 'bg-signal-amber/10 text-signal-amber', order: 2 },
  watch: { label: 'Vigilar', badge: 'bg-signal-blue/10 text-signal-blue', order: 3 },
  maintain: { label: 'Mantener', badge: 'bg-signal-teal/10 text-signal-tealDark', order: 4 },
};

const CONFIDENCE_LABEL: Record<Recommendation['confidence'], string> = { high: 'Alta', medium: 'Media', low: 'Baja' };

function RecommendationCard({ r }: { r: Recommendation }) {
  const [open, setOpen] = useState(r.category === 'change' || r.category === 'remove');
  const meta = CATEGORY_META[r.category];

  return (
    <div className="card overflow-hidden">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left">
        <div className="flex items-center gap-3">
          <span className={`pill ${meta.badge}`}>{meta.label}</span>
          <span className="text-sm font-medium text-ink-950">{r.targetLabel}</span>
        </div>
        <span className="text-xs text-ink-400">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-ink-100 px-4 py-4 text-sm leading-relaxed">
          {r.whatToChange && (
            <p>
              <span className="font-medium text-ink-950">Qué cambiar: </span>
              <span className="text-ink-700">{r.whatToChange}</span>
            </p>
          )}
          <p>
            <span className="font-medium text-ink-950">Por qué: </span>
            <span className="text-ink-700">{r.why}</span>
          </p>
          {r.problemSolved && (
            <p>
              <span className="font-medium text-ink-950">Qué problema resuelve: </span>
              <span className="text-ink-700">{r.problemSolved}</span>
            </p>
          )}
          {r.riskReduced && (
            <p>
              <span className="font-medium text-ink-950">Riesgo que reduce: </span>
              <span className="text-ink-700">{r.riskReduced}</span>
            </p>
          )}
          {r.riskIncreased && (
            <p>
              <span className="font-medium text-ink-950">Riesgo que aumenta: </span>
              <span className="text-ink-700">{r.riskIncreased}</span>
            </p>
          )}
          <p>
            <span className="font-medium text-ink-950">Impacto en la cartera: </span>
            <span className="text-ink-700">{r.portfolioImpact}</span>
          </p>
          {r.alternative && (
            <p>
              <span className="font-medium text-ink-950">Alternativa: </span>
              <span className="text-ink-700">{r.alternative}</span>
            </p>
          )}
          {r.evidence.length > 0 && (
            <div>
              <span className="font-medium text-ink-950">Evidencia: </span>
              <ul className="mt-1 list-inside list-disc text-ink-700">
                {r.evidence.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          {r.taxOrCostConsiderations && (
            <p>
              <span className="font-medium text-ink-950">Fiscalidad/coste: </span>
              <span className="text-ink-700">{r.taxOrCostConsiderations}</span>
            </p>
          )}
          <p className="text-xs text-ink-400">
            Confianza {CONFIDENCE_LABEL[r.confidence]}: {r.confidenceRationale}
          </p>
        </div>
      )}
    </div>
  );
}

export function RecommendationsSection({ recommendations }: { recommendations: Recommendation[] }) {
  const sorted = [...recommendations].sort((a, b) => CATEGORY_META[a.category].order - CATEGORY_META[b.category].order);
  const counts = recommendations.reduce<Record<string, number>>((acc, r) => {
    acc[r.category] = (acc[r.category] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <Section title="Recomendaciones" subtitle="Cada recomendación explica qué cambiaría, por qué, y con qué nivel de confianza. Sin razón sólida, no hay cambio.">
      <div className="mb-6 flex flex-wrap gap-2">
        {(['change', 'remove', 'review', 'watch', 'maintain'] as RecommendationCategory[]).map((cat) =>
          counts[cat] ? (
            <span key={cat} className={`pill ${CATEGORY_META[cat].badge}`}>
              {counts[cat]} {CATEGORY_META[cat].label.toLowerCase()}
            </span>
          ) : null,
        )}
      </div>
      <div className="space-y-3">
        {sorted.map((r) => (
          <RecommendationCard key={r.id} r={r} />
        ))}
      </div>
    </Section>
  );
}
