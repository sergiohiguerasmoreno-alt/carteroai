import 'server-only';

export class MarketDataFetchError extends Error {}

/** fetch con timeout, pensado para llamadas a APIs de mercado desde el servidor. */
export async function fetchJson<T>(url: string, timeoutMs = 8000): Promise<T | undefined> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) return undefined;
    return (await res.json()) as T;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchText(url: string, timeoutMs = 8000): Promise<string | undefined> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return undefined;
    return await res.text();
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}
