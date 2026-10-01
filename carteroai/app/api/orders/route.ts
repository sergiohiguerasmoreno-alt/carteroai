import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { CreateOrderRequestSchema } from '@/lib/validation/schemas';
import { createOrder, isOrderStoreConfigured } from '@/lib/payments/store';
import { isStripeConfigured, REPORT_PRICE_CENTS, REPORT_PRICE_CURRENCY } from '@/lib/payments/stripe';
import { checkRateLimit, clientIdentifier } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 15;

/**
 * Crea el "pedido" justo cuando el usuario llega a la pantalla del informe:
 * guarda el análisis, la cartera y el perfil para poder mostrarlos de nuevo
 * al volver del pago de Stripe (ver lib/payments/store.ts).
 *
 * Si Stripe o la base de datos no están configurados, respondemos
 * `locked: false` en vez de un error: el informe se muestra gratis sin
 * muro de pago, igual que hace el resto de la aplicación cuando un
 * servicio opcional no está disponible (ver app/api/leads/route.ts). Así,
 * en cuanto se añada STRIPE_SECRET_KEY el muro de pago se activa solo, sin
 * tocar código ni volver a desplegar.
 */
export async function POST(req: NextRequest) {
  const id = clientIdentifier(req.headers);
  const { allowed } = checkRateLimit(`orders:${id}`);
  if (!allowed) {
    return NextResponse.json({ error: 'Demasiadas peticiones. Inténtalo de nuevo en un minuto.' }, { status: 429 });
  }

  if (!isStripeConfigured() || !isOrderStoreConfigured()) {
    return NextResponse.json({ locked: false });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Petición no válida.' }, { status: 400 });
  }

  const parsed = CreateOrderRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos del informe no válidos.' }, { status: 400 });
  }

  const orderId = nanoid();
  const result = await createOrder(orderId, parsed.data, REPORT_PRICE_CENTS, REPORT_PRICE_CURRENCY);
  if (!result.ok) {
    console.error('No se ha podido crear el pedido:', result.reason);
    // Fallo de infraestructura al crear el pedido: mejor mostrar el
    // informe gratis que dejar al usuario sin nada tras generar su análisis.
    return NextResponse.json({ locked: false });
  }

  return NextResponse.json({ locked: true, orderId });
}
