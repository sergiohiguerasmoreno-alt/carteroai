import { NextRequest, NextResponse } from 'next/server';
import { getOrder } from '@/lib/payments/store';
import { checkRateLimit, clientIdentifier } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 15;

/**
 * Devuelve el estado actual de un pedido (sin desbloquear nada): se usa al
 * volver a /analizar?order=... para recomponer la pantalla — ya sea el
 * muro de pago (si sigue 'pending', p.ej. el usuario canceló el pago en
 * Stripe y pulsó "atrás") o el informe completo (si ya está 'paid' o
 * 'free_shared') — sin que el usuario tenga que repetir todo el proceso de
 * subir el PDF y responder el cuestionario.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const id = clientIdentifier(req.headers);
  const { allowed } = checkRateLimit(`orders-get:${id}`);
  if (!allowed) {
    return NextResponse.json({ error: 'Demasiadas peticiones. Inténtalo de nuevo en un minuto.' }, { status: 429 });
  }

  const order = await getOrder(params.id);
  if (!order) {
    return NextResponse.json({ error: 'No se encuentra el pedido.' }, { status: 404 });
  }

  return NextResponse.json({ status: order.status, payload: order.payload });
}
