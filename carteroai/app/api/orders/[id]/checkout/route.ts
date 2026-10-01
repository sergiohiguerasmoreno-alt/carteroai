import { NextRequest, NextResponse } from 'next/server';
import { getOrder, setOrderStripeSession } from '@/lib/payments/store';
import {
  getStripeClient,
  isStripeConfigured,
  REPORT_PRICE_CENTS,
  REPORT_PRICE_CURRENCY,
  REPORT_PRODUCT_NAME,
} from '@/lib/payments/stripe';
import { checkRateLimit, clientIdentifier } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 15;

/**
 * Crea una Stripe Checkout Session (la página de pago alojada por Stripe,
 * que nunca ve nuestro servidor) para desbloquear un pedido concreto. El
 * precio se fija aquí mismo con `price_data` en vez de depender de un
 * Producto/Precio creado a mano en el panel de Stripe: así no hace falta
 * ningún paso de configuración en Stripe aparte de la clave secreta.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const id = clientIdentifier(req.headers);
  const { allowed } = checkRateLimit(`checkout:${id}`);
  if (!allowed) {
    return NextResponse.json({ error: 'Demasiadas peticiones. Inténtalo de nuevo en un minuto.' }, { status: 429 });
  }

  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'El pago no está disponible ahora mismo. Inténtalo más tarde.' }, { status: 503 });
  }

  const order = await getOrder(params.id);
  if (!order) {
    return NextResponse.json({ error: 'No se encuentra el pedido.' }, { status: 404 });
  }
  if (order.status !== 'pending') {
    return NextResponse.json({ error: 'Este informe ya está desbloqueado.' }, { status: 400 });
  }

  try {
    const origin = req.nextUrl.origin;
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: REPORT_PRICE_CURRENCY,
            unit_amount: REPORT_PRICE_CENTS,
            product_data: { name: REPORT_PRODUCT_NAME },
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/analizar?order=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/analizar?order=${order.id}&canceled=1`,
      metadata: { orderId: order.id },
    });

    if (!session.url) {
      throw new Error('Stripe no ha devuelto una URL de pago.');
    }

    await setOrderStripeSession(order.id, session.id);
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('Error creando la sesión de pago:', err instanceof Error ? err.message : 'error desconocido');
    return NextResponse.json({ error: 'No se ha podido iniciar el pago. Inténtalo de nuevo.' }, { status: 500 });
  }
}
