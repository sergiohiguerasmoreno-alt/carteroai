import 'server-only';
import * as pdfjsWorkerEntry from 'pdfjs-dist/legacy/build/pdf.worker.mjs';

/**
 * Extracción de texto de un PDF. Se ejecuta EXCLUSIVAMENTE en servidor.
 * El buffer del PDF nunca se escribe en disco ni se registra en logs:
 * se procesa en memoria y se descarta al finalizar la petición.
 *
 * Usamos pdfjs-dist directamente (en vez de envoltorios como pdf-parse, sin
 * mantenimiento desde hace años y frágiles ante PDFs con tablas de xref no
 * estándar) y reconstruimos las líneas a partir de la posición (x, y) de
 * cada fragmento de texto, agrupando por coordenada Y — más fiel al
 * formato tabular real de los extractos de cartera que una simple
 * concatenación de fragmentos.
 *
 * IMPORTANTE — worker de pdfjs-dist en entornos serverless (Vercel/Lambda):
 * incluso en Node, pdfjs-dist necesita su módulo "worker" (lo ejecuta en el
 * mismo hilo mediante un "fake worker", no un hilo real). Internamente lo
 * localiza con una ruta calculada en tiempo de ejecución
 * (`import(this.workerSrc)`), que el trazador de archivos de Next/Vercel no
 * puede seguir por ser dinámica — así que en local funciona (todo
 * `node_modules` está presente) pero en la función serverless desplegada el
 * archivo del worker no se incluye y la extracción falla en producción.
 * Lo evitamos importando el worker de forma ESTÁTICA (ruta literal, que el
 * trazador sí detecta) y registrándolo en `globalThis.pdfjsWorker`: pdfjs-dist
 * lo usa directamente sin tener que resolver ninguna ruta en tiempo de
 * ejecución.
 */
(globalThis as unknown as { pdfjsWorker?: unknown }).pdfjsWorker = pdfjsWorkerEntry;
export interface ExtractedPdf {
  text: string;
  numPages: number;
}

export interface TextItemLike {
  str: string;
  transform: number[];
}

// Un token corto en mayúsculas, sin nada más, es casi siempre un ticker
// bursátil suelto (p.ej. "MSFT", "ASML") cuando aparece como fragmento de
// texto independiente. Ver más abajo (splitMergedColumnRow) para el porqué.
const BARE_TICKER_RE = /^[A-ZÑ]{2,6}$/;
// Palabras cortas en mayúsculas que SÍ pueden aparecer sueltas en tablas o
// cabeceras sin ser un ticker: evita que activen por error la detección de
// "varias tarjetas fusionadas en la misma fila".
const TICKER_LIKE_STOPLIST = new Set([
  'TOTAL', 'SUBTOTAL', 'SALDO', 'ETF', 'ETFS', 'ETC', 'ETP', 'FI', 'SICAV', 'PLC', 'INC', 'CORP', 'LTD', 'CO',
  'SA', 'SAU', 'SL', 'SE', 'AG', 'NV', 'GMBH', 'SPA', 'ASA', 'OYJ', 'ACC', 'DIST', 'MES', 'AÑO', 'AÑOS', 'DE',
  'EUR', 'USD', 'GBP', 'CHF', 'JPY', 'GBX', 'CAD', 'AUD', 'SEK', 'NOK', 'DKK',
]);

/**
 * Algunos documentos maquetan las posiciones individuales como "tarjetas" en
 * dos columnas (dos instrumentos codo con codo). Al agrupar por coordenada Y,
 * dos tarjetas con la misma altura de fila producen fragmentos de AMBAS
 * mezclados en una sola línea de texto (p.ej. "MSFT ...descripción... 2.5%
 * ASML 2.5%"), lo que hace perder o corromper una de las dos posiciones.
 *
 * Señal para detectarlo: dos o más fragmentos de esa misma fila son, cada
 * uno, un token corto en mayúsculas y nada más (un ticker suelto) — algo que
 * una fila de una sola posición prácticamente nunca tiene, porque el ticker
 * de una posición aparece una única vez. Cuando se detecta, se corta la fila
 * justo antes de cada ticker adicional, para separar de nuevo el contenido
 * de cada tarjeta en su propia línea.
 */
function splitMergedColumnRow(frags: { x: number; str: string }[]): { x: number; str: string }[][] {
  const sorted = frags.slice().sort((a, b) => a.x - b.x);
  const tickerIndexes: number[] = [];
  sorted.forEach((f, i) => {
    const t = f.str.trim();
    if (BARE_TICKER_RE.test(t) && !TICKER_LIKE_STOPLIST.has(t)) tickerIndexes.push(i);
  });
  if (tickerIndexes.length < 2) return [sorted];

  const cutPoints = [0, ...tickerIndexes.slice(1), sorted.length];
  const groups: { x: number; str: string }[][] = [];
  for (let k = 0; k < cutPoints.length - 1; k++) {
    const slice = sorted.slice(cutPoints[k], cutPoints[k + 1]);
    if (slice.length > 0) groups.push(slice);
  }
  return groups;
}

export function reconstructPageText(items: TextItemLike[]): string {
  // Agrupamos fragmentos por su coordenada Y (redondeada) para formar líneas,
  // y dentro de cada línea ordenamos por X para respetar el orden de columnas.
  const rows = new Map<number, { x: number; str: string }[]>();
  for (const item of items) {
    if (!item.str) continue;
    const y = Math.round(item.transform[5] ?? 0);
    const x = item.transform[4] ?? 0;
    // Se agrupan coordenadas Y muy próximas (±2px) en la misma fila para
    // absorber pequeñas variaciones de línea base entre fuentes.
    let key = y;
    for (const existingY of rows.keys()) {
      if (Math.abs(existingY - y) <= 2) {
        key = existingY;
        break;
      }
    }
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key)!.push({ x, str: item.str });
  }

  const sortedRows = Array.from(rows.entries()).sort((a, b) => b[0] - a[0]); // Y descendente = de arriba a abajo
  const lines: string[] = [];
  for (const [, frags] of sortedRows) {
    for (const group of splitMergedColumnRow(frags)) {
      lines.push(
        group
          .map((f) => f.str)
          .join(' ')
          .replace(/\s{2,}/g, '  '),
      );
    }
  }
  return lines.join('\n');
}

export async function extractPdfText(buffer: Buffer): Promise<ExtractedPdf> {
  // Import dinámico: evita que pdfjs-dist se cargue en el bundle de cliente.
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    disableFontFace: true,
    isEvalSupported: false,
  });

  const doc = await loadingTask.promise;
  const pageTexts: string[] = [];

  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const items = (content.items as unknown[]).filter((it): it is TextItemLike => typeof it === 'object' && it !== null && 'str' in it);
      pageTexts.push(reconstructPageText(items));
    }
  } finally {
    await doc.destroy();
  }

  return { text: pageTexts.join('\n'), numPages: doc.numPages };
}
