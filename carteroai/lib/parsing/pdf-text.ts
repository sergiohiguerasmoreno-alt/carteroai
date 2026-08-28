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

interface TextItemLike {
  str: string;
  transform: number[];
}

function reconstructPageText(items: TextItemLike[]): string {
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
  return sortedRows
    .map(([, frags]) =>
      frags
        .sort((a, b) => a.x - b.x)
        .map((f) => f.str)
        .join(' ')
        .replace(/\s{2,}/g, '  '),
    )
    .join('\n');
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
