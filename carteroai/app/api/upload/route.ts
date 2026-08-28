import { NextRequest, NextResponse } from 'next/server';
import { extractPdfText } from '@/lib/parsing/pdf-text';
import { extractPositionsFromText } from '@/lib/parsing/position-extractor';
import { buildPreliminarySummary } from '@/lib/parsing/preliminary-summary';
import { validatePdfUpload, hasPdfMagicBytes } from '@/lib/security/validate-upload';
import { checkRateLimit, clientIdentifier } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Recibe un PDF, lo procesa ÍNTEGRAMENTE en memoria y devuelve las
 * posiciones detectadas. El archivo nunca se escribe en disco ni se
 * conserva tras responder a esta petición; tampoco se registra su
 * contenido en logs.
 */
export async function POST(req: NextRequest) {
  const id = clientIdentifier(req.headers);
  const { allowed } = checkRateLimit(`upload:${id}`);
  if (!allowed) {
    return NextResponse.json({ error: 'Demasiadas peticiones. Inténtalo de nuevo en un minuto.' }, { status: 429 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'No se ha podido leer la petición.' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No se ha adjuntado ningún archivo.' }, { status: 400 });
  }

  const validation = validatePdfUpload({ size: file.size, type: file.type, name: file.name });
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (!hasPdfMagicBytes(buffer)) {
    return NextResponse.json({ error: 'El archivo no parece ser un PDF válido.' }, { status: 400 });
  }

  try {
    const { text, numPages } = await extractPdfText(buffer);
    if (!text || text.trim().length < 20) {
      return NextResponse.json(
        {
          error: 'No se ha podido extraer texto de este PDF (puede ser una imagen escaneada). Prueba con otro archivo.',
          portfolio: {
            id: 'manual',
            positions: [],
            baseCurrency: 'EUR',
            sourceFileName: file.name,
            extractedAt: new Date().toISOString(),
            extractionWarnings: ['El PDF no contiene texto extraíble.'],
          },
        },
        { status: 200 },
      );
    }

    const portfolio = extractPositionsFromText(text, file.name);
    const preliminarySummary = buildPreliminarySummary(portfolio);

    return NextResponse.json({ portfolio, preliminarySummary, numPages });
  } catch (err) {
    console.error('Error procesando PDF:', err instanceof Error ? err.message : 'error desconocido');
    return NextResponse.json({ error: 'No se ha podido procesar el PDF. Prueba con otro archivo, idealmente el extracto de posiciones de tu bróker o banco en formato tabla.' }, { status: 422 });
  }
  // El buffer queda fuera de alcance al terminar esta función y es recolectado por el GC; no se persiste en ningún momento.
}
