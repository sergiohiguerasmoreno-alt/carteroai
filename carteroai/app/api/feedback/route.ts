import { NextRequest, NextResponse } from 'next/server';
import { FeedbackRequestSchema } from '@/lib/validation/schemas';
import { appendFeedback } from '@/lib/feedback/store';
import { checkRateLimit, clientIdentifier } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 15;

/**
 * Guarda la valoración del informe (útil / no útil) y un comentario
 * opcional. Es anónimo: no requiere email ni ningún dato personal. Igual
 * que en /api/leads, un fallo al guardar nunca bloquea al usuario — se
 * responde ok:true a efectos de UX y el motivo se registra en logs del
 * servidor para poder diagnosticarlo.
 */
export async function POST(req: NextRequest) {
  const id = clientIdentifier(req.headers);
  const { allowed } = checkRateLimit(`feedback:${id}`);
  if (!allowed) {
    return NextResponse.json({ error: 'Demasiadas peticiones. Inténtalo de nuevo en un minuto.' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Petición no válida.' }, { status: 400 });
  }

  const parsed = FeedbackRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos de feedback no válidos.' }, { status: 400 });
  }

  const result = await appendFeedback(parsed.data.reportId, parsed.data.helpful, parsed.data.comment);
  if (!result.ok) {
    console.error('No se ha podido guardar el feedback:', result.reason);
  }

  return NextResponse.json({ ok: true, saved: result.ok });
}
