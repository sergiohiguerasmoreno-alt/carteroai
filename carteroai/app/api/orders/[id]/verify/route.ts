import { NextRequest, NextResponse } from 'next/server';
import { getOrder, markOrderPaid } from '@/lib/payments/store';
import { getStripeClient, isStripeConfigured } from '@/lib/payments/stripe';
import { checkRateLimit, clientIdentifier } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 15;

/**
 * Se llama al volver de Stripe Checkout (success_url) para confirmar que el
 * pago se completó de verdad antes de desbloquear nada. Dos comprobaciones,
 * no solo una:
 *  1. El `sessionId` recibido tiene que coincidir con el que guardamos al
 *     crear la sesión para ESTE pedido — evita que alguien desbloquee un
 *     pedido ajeno pegando cualquier session_id en la URL.
 *  2. Se le pregunta a Stripe directamente (con la clave secreta, nunca nos
 *     fiamos de parámetros de la URL) si esa sesión está realmente pagada.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const id = clientIdentifier(req.headers);
  const { allowed } = checkRateLimit(`verify:${id}`);
  if (!allowed) {
    return NextResponse.json({ error: 'Demasiadas peticiones. Inténtalo de nuevo en un minuto.' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Petición no válida.' }, { status: 400 });
  }
  const sessionId = typeof (body as { sessionId?: unknown })?.sessionId === 'string' ? (body as { sessionId: string }).sessionId : undefined;

  const order = await getOrder(params.id);
  if (!order) {
    return NextResponse.json({ error: 'No se encuentra el pedido.' }, { status: 404 });
  }

  if (order.status === 'paid' || order.status === 'free_shared') {
    return NextResponse.json({ unlocked: true, payload: order.payload });
  }

  if (!sessionId || order.stripeSessionId !== sessionId) {
    return NextResponse.json({ unlocked: false, error: 'No se ha podido verificar el pago.' }, { status: 400 });
  }

  if (!isStripeConfigured()) {
    return NextResponse.json({ unlocked: false, error: 'El pago no está disponible ahora mismo.' }, { status: 503 });
  }

  try {
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') {
      return NextResponse.json({ unlocked: false, error: 'El pago no se ha completado todavía.' });
    }

    await markOrderPaid(order.id);
    return NextResponse.json({ unlocked: true, payload: order.payload });
  } catch (err) {
    console.error('Error verificando el pago:', err instanceof Error ? err.message : 'error desconocido');
    return NextResponse.json({ unlocked: false, error: 'No se ha podido verificar el pago. Inténtalo de nuevo.' }, { status: 500 });
  }
}
