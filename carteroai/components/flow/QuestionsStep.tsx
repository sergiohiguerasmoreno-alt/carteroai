'use client';

import { useMemo } from 'react';
import { visibleGroups, visibleQuestions, isGroupComplete } from '@/lib/questions/engine';
import type { AnswerMap, QuestionDef } from '@/lib/questions/types';

interface Props {
  answers: AnswerMap;
  onAnswersChange: (answers: AnswerMap) => void;
  groupIndex: number;
  onGroupIndexChange: (index: number) => void;
  onComplete: () => void;
}

function QuestionField({ q, value, onChange }: { q: QuestionDef; value: unknown; onChange: (v: unknown) => void }) {
  if (q.type === 'single_choice') {
    return (
      <div className="space-y-2">
        {q.options?.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={
              'w-full rounded-lg border px-4 py-3 text-left text-sm transition ' +
              (value === opt.value ? 'border-signal-teal bg-signal-teal/5 text-ink-950' : 'border-ink-200 text-ink-700 hover:border-ink-400')
            }
          >
            {opt.label}
          </button>
        ))}
      </div>
    );
  }

  if (q.type === 'multi_choice') {
    const selected = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div className="flex flex-wrap gap-2">
        {q.options?.map((opt) => {
          const active = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(active ? selected.filter((v) => v !== opt.value) : [...selected, opt.value])}
              className={
                'rounded-full border px-4 py-2 text-sm transition ' +
                (active ? 'border-signal-teal bg-signal-teal/5 text-ink-950' : 'border-ink-200 text-ink-700 hover:border-ink-400')
              }
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    );
  }

  if (q.type === 'boolean') {
    return (
      <div className="flex gap-2">
        {[
          { v: true, l: 'Sí' },
          { v: false, l: 'No' },
        ].map((opt) => (
          <button
            key={String(opt.v)}
            type="button"
            onClick={() => onChange(opt.v)}
            className={
              'flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition ' +
              (value === opt.v ? 'border-signal-teal bg-signal-teal/5 text-ink-950' : 'border-ink-200 text-ink-700 hover:border-ink-400')
            }
          >
            {opt.l}
          </button>
        ))}
      </div>
    );
  }

  if (q.type === 'number') {
    return (
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={q.min}
          max={q.max}
          step={q.step ?? 1}
          className="input-field max-w-[140px]"
          value={typeof value === 'number' ? value : ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
        />
        {q.unit && <span className="text-sm text-ink-400">{q.unit}</span>}
      </div>
    );
  }

  return (
    <input
      type="text"
      className="input-field"
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function QuestionsStep({ answers, onAnswersChange, groupIndex, onGroupIndexChange, onComplete }: Props) {
  const groups = useMemo(() => visibleGroups(answers), [answers]);
  const group = groups[groupIndex];

  if (!group) return null;

  const questions = visibleQuestions(group, answers);
  const complete = isGroupComplete(group, answers);
  const isLast = groupIndex === groups.length - 1;

  function setAnswer(id: string, value: unknown) {
    onAnswersChange({ ...answers, [id]: value as never });
  }

  function next() {
    if (isLast) {
      onComplete();
    } else {
      onGroupIndexChange(groupIndex + 1);
    }
  }

  return (
    <div className="container-app flex min-h-[85vh] flex-col py-10">
      <p className="label-sm mb-2 text-signal-teal">Paso 3 de 5</p>
      <div className="mb-8 flex gap-1.5">
        {groups.map((g, i) => (
          <div key={g.id} className={'h-1 flex-1 rounded-full ' + (i <= groupIndex ? 'bg-signal-teal' : 'bg-ink-100')} />
        ))}
      </div>

      <div className="flex-1">
        <h1 className="mb-2 font-serif text-2xl text-ink-950 sm:text-3xl">{group.title}</h1>
        <p className="mb-8 text-sm text-ink-500">{group.subtitle}</p>

        <div className="space-y-8">
          {questions.map((q) => (
            <div key={q.id}>
              <p className="mb-1 text-sm font-medium text-ink-900">{q.title}</p>
              {q.helpText && <p className="mb-3 text-xs text-ink-400">{q.helpText}</p>}
              {!q.helpText && <div className="mb-3" />}
              <QuestionField q={q} value={answers[q.id]} onChange={(v) => setAnswer(q.id, v)} />
            </div>
          ))}
        </div>
      </div>

      <div className="sticky bottom-0 mt-10 flex items-center justify-between gap-3 border-t border-ink-100 bg-white/90 py-4 backdrop-blur">
        <button
          onClick={() => onGroupIndexChange(Math.max(0, groupIndex - 1))}
          disabled={groupIndex === 0}
          className="btn-secondary"
        >
          Atrás
        </button>
        <button onClick={next} disabled={!complete} className="btn-primary">
          {isLast ? 'Ver mi análisis' : 'Siguiente'}
        </button>
      </div>
    </div>
  );
}
