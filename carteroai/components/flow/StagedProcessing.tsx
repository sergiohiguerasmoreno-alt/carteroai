'use client';

import { useEffect, useState } from 'react';

interface Props {
  title: string;
  stages: string[];
  /** ms aproximados por etapa antes de avanzar visualmente a la siguiente (la última se queda fija hasta que el padre cambie de pantalla). */
  stepDurationMs?: number;
}

export function StagedProcessing({ title, stages, stepDurationMs = 1100 }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (activeIndex >= stages.length - 1) return;
    const t = setTimeout(() => setActiveIndex((i) => Math.min(i + 1, stages.length - 1)), stepDurationMs);
    return () => clearTimeout(t);
  }, [activeIndex, stages.length, stepDurationMs]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-5 py-16 text-center">
      <div className="mb-8 h-10 w-10 animate-spin rounded-full border-2 border-ink-200 border-t-signal-teal" aria-hidden />
      <h2 className="mb-8 font-serif text-2xl text-ink-950">{title}</h2>
      <ul className="w-full max-w-sm space-y-3 text-left">
        {stages.map((s, i) => {
          const state = i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'pending';
          return (
            <li key={s} className="flex items-center gap-3">
              <span
                className={
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ' +
                  (state === 'done'
                    ? 'bg-signal-teal text-white'
                    : state === 'active'
                      ? 'border-2 border-signal-teal text-signal-teal'
                      : 'border border-ink-200 text-ink-300')
                }
              >
                {state === 'done' ? '✓' : i + 1}
              </span>
              <span className={state === 'pending' ? 'text-sm text-ink-300' : state === 'active' ? 'text-sm font-medium text-ink-950' : 'text-sm text-ink-500 line-through decoration-ink-200'}>
                {s}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
