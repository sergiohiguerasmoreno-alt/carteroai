'use client';

import { useState } from 'react';

interface Props {
  onSubmit: (email: string) => void;
  submitting: boolean;
  errorMessage?: string | null;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function EmailGateStep({ onSubmit, submitting, errorMessage }: Props) {
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [touched, setTouched] = useState(false);

  const emailValid = isValidEmail(email);
  const canSubmit = emailValid && consent && !submitting;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    onSubmit(email.trim());
  }

  return (
    <div className="container-app flex min-h-[80vh] flex-col justify-center py-12">
      <p className="label-sm mb-2 text-signal-teal">Último paso</p>
      <h1 className="mb-3 font-serif text-3xl text-ink-950 sm:text-4xl">Tu análisis está listo para generarse</h1>
      <p className="mb-8 max-w-lg text-sm leading-relaxed text-ink-600">
        Déjanos tu email para acceder a tu informe. Lo usaremos para enviarte información sobre CarteroAI y sobre
        análisis de inversión — nunca compartiremos tu cartera ni tus respuestas con nadie, y puedes darte de baja
        cuando quieras.
      </p>

      <form onSubmit={handleSubmit} className="max-w-md space-y-4">
        <label className="block text-xs font-medium text-ink-500">
          Email
          <input
            type="email"
            required
            className="input-field mt-1"
            placeholder="tu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched(true)}
          />
          {touched && !emailValid && <p className="mt-1 text-xs text-signal-rose">Introduce un email válido.</p>}
        </label>

        <label className="flex items-start gap-2.5 text-xs text-ink-600">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-ink-300 text-signal-teal focus:ring-signal-teal/30"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span>
            Acepto que CarteroAI guarde mi email para enviarme comunicaciones sobre la plataforma y sobre análisis de
            inversión, según el{' '}
            <a href="/legal" target="_blank" className="underline hover:text-ink-950">
              aviso legal y de privacidad
            </a>
            .
          </span>
        </label>

        {errorMessage && <p className="text-xs text-signal-rose">{errorMessage}</p>}

        <button type="submit" disabled={!canSubmit} className="btn-primary w-full sm:w-auto">
          {submitting ? 'Generando tu informe…' : 'Ver mi análisis'}
        </button>
      </form>
    </div>
  );
}
