'use client';

import { useState } from 'react';

interface Props {
  reportId: string;
}

type Phase = 'rating' | 'comment' | 'done';

/**
 * Valoración rápida y anónima del informe ("¿te ha resultado útil?"), con
 * un comentario opcional. Se envía a /api/feedback (best-effort: si falla
 * o tarda, no se le muestra ningún error al usuario — es un canal de
 * mejora interno, nunca un requisito para usar la app).
 */
export function FeedbackWidget({ reportId }: Props) {
  const [phase, setPhase] = useState<Phase>('rating');
  const [helpful, setHelpful] = useState<boolean | null>(null);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);

  function choose(value: boolean) {
    setHelpful(value);
    setPhase('comment');
  }

  async function send() {
    if (helpful === null) return;
    setSending(true);
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId, helpful, comment: comment.trim() || undefined }),
      });
    } catch {
      // Silencioso a propósito: el feedback nunca debe interrumpir al usuario.
    } finally {
      setSending(false);
      setPhase('done');
    }
  }

  return (
    <div className="card mt-10 p-6 text-center">
      {phase === 'rating' && (
        <>
          <p className="text-sm font-medium text-ink-950">¿Te ha resultado útil este informe?</p>
          <div className="mt-3 flex justify-center gap-3">
            <button onClick={() => choose(true)} className="btn-secondary" aria-label="Sí, me ha resultado útil">
              👍 Sí
            </button>
            <button onClick={() => choose(false)} className="btn-secondary" aria-label="No me ha resultado útil">
              👎 No
            </button>
          </div>
        </>
      )}

      {phase === 'comment' && (
        <>
          <p className="text-sm font-medium text-ink-950">Gracias. ¿Quieres contarnos algo más? (opcional)</p>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Escribe aquí tu comentario…"
            rows={3}
            maxLength={1000}
            className="input-field mt-3"
          />
          <div className="mt-3 flex justify-center gap-3">
            <button onClick={send} disabled={sending} className="btn-primary">
              {sending ? 'Enviando…' : 'Enviar'}
            </button>
          </div>
        </>
      )}

      {phase === 'done' && <p className="text-sm font-medium text-signal-tealDark">¡Gracias por tu opinión!</p>}
    </div>
  );
}
