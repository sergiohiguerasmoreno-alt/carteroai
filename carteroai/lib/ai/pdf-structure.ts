import { z } from 'zod';
import { generateText, isAiConfigured } from './client';

/**
 * Ayuda de IA para LOCALIZAR la tabla de posiciones dentro de un extracto de
 * cartera en PDF, cuando el formato es poco habitual (varias cuentas, texto
 * legal mezclado con la tabla, columnas reordenadas, etc.).
 *
 * IMPORTANTE — límite estricto: esta capa NUNCA extrae ni inventa cifras. Su
 * única salida son rangos de líneas (números de línea, no datos financieros)
 * que apuntan al texto EXACTO del PDF. El parser determinista de
 * lib/parsing/position-extractor.ts sigue siendo el único que lee nombres,
 * cantidades, precios y valores, siempre a partir del texto literal — igual
 * que si la IA nunca hubiera intervenido. Si algo falla aquí, se usa el texto
 * completo tal cual, sin ningún cambio de comportamiento.
 */

export interface LineRange {
  start: number;
  end: number;
}

const RangesSchema = z.object({
  ranges: z
    .array(
      z.object({
        start: z.number().int().min(0),
        end: z.number().int().min(0),
      }),
    )
    .max(20),
});

const MAX_LINES_FOR_AI = 400;

/**
 * Devuelve los rangos de línea (0-indexados, ambos extremos incluidos) donde
 * probablemente está la tabla de posiciones, o null si la IA no está
 * configurada, falla, o el documento es demasiado largo para esta ayuda.
 */
export async function findPositionTableLines(lines: string[]): Promise<LineRange[] | null> {
  if (!isAiConfigured()) return null;
  if (lines.length === 0 || lines.length > MAX_LINES_FOR_AI) return null;

  const numbered = lines.map((l, i) => `${i}: ${l}`).join('\n');

  const system = `Ayudas a localizar, dentro del texto de un extracto de cartera de inversión (banco o bróker), en qué líneas está la tabla de posiciones (acciones, ETFs, fondos, bonos, efectivo...) con sus cantidades o valores.

REGLA ESTRICTA: no calcules, corrijas ni menciones ninguna cifra financiera. Tu única salida son números de línea, nunca datos de la cartera.

Responde EXCLUSIVAMENTE con un JSON válido de esta forma exacta, sin texto adicional ni bloques de código:
{"ranges": [{"start": <línea inicial>, "end": <línea final, inclusive>}]}

Si el documento tiene varias tablas (p.ej. varias cuentas), incluye varios rangos. Si no identificas ninguna tabla con claridad, responde {"ranges": []}.`;

  const raw = await generateText({ system, user: numbered, maxTokens: 500 });
  if (!raw) return null;

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = RangesSchema.parse(JSON.parse(jsonMatch[0]));

    const maxIndex = lines.length - 1;
    const ranges = parsed.ranges
      .map((r) => ({ start: Math.max(0, Math.min(r.start, maxIndex)), end: Math.max(0, Math.min(r.end, maxIndex)) }))
      .filter((r) => r.start <= r.end);

    return ranges.length > 0 ? ranges : null;
  } catch {
    return null;
  }
}
