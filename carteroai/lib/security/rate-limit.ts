import 'server-only';

/**
 * Limitador de peticiones muy simple, en memoria, por IP. Es una protección
 * básica de primera línea contra abuso adecuada para una única instancia.
 * En un despliegue multi-instancia (varias funciones serverless en
 * paralelo) cada instancia tiene su propio contador: para un límite
 * estrictamente global habría que sustituir este módulo por uno respaldado
 * por un almacén compartido (p.ej. Upstash Redis), sin tocar el resto de
 * la aplicación gracias a que toda la lógica pasa por esta única función.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;

export function checkRateLimit(identifier: string): { allowed: boolean; remaining: number } {
  const limit = Number(process.env.RATE_LIMIT_PER_MINUTE ?? 20);
  const now = Date.now();
  const bucket = buckets.get(identifier);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(identifier, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: limit - 1 };
  }

  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  bucket.count += 1;
  return { allowed: true, remaining: limit - bucket.count };
}

export function clientIdentifier(headers: Headers): string {
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || 'unknown';
}
