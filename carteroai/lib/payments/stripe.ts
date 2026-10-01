import 'server-only';
import Stripe from 'stripe';

/**
 * Cliente de Stripe para el pago único del informe completo. Se usa Stripe
 * Checkout (página alojada por Stripe): la aplicación nunca ve ni maneja
 * directamente ningún dato de tarjeta — eso lo hace Stripe en su propia
 * página — así que solo necesitamos la clave secreta (`STRIPE_SECRET_KEY`)
 * para crear la sesión de pago y, al volver, verificar que se completó.
 *
 * No se fija `apiVersion` a propósito: así el SDK usa siempre la versión
 * con la que fue publicado, sin tener que mantenerla sincronizada a mano.
 */

const REPORT_PRICE_EUR = 9.99;

export const REPORT_PRICE_CENTS = Math.round(REPORT_PRICE_EUR * 100);
export const REPORT_PRICE_CURRENCY = 'eur';
export const REPORT_PRODUCT_NAME = 'CarteroAI — Informe completo de tu cartera';

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

let client: Stripe | null = null;

export function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('Falta STRIPE_SECRET_KEY: no se puede procesar el pago.');
  }
  if (!client) {
    client = new Stripe(secretKey);
  }
  return client;
}
