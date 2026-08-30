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
// Limitado a 5 letras (los tickers de las bolsas más habituales rara vez
// superan esa longitud) y no 6: algunas marcas se escriben enteramente en
// mayúsculas en el propio nombre del producto (p.ej. "NVIDIA"), y un límite
// de 6 las confunde con un ticker suelto.
const BARE_TICKER_RE = /^[A-ZÑ]{2,5}$/;
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

type Frag = { x: number; str: string };
type Row = { y: number; frags: Frag[] };

// ---- Reconstrucción consciente de "tarjetas" en dos columnas ----
//
// splitMergedColumnRow (arriba) resuelve el caso en el que TODOS los campos
// de dos tarjetas vecinas (ticker, nombre, peso, importe...) caen en la
// misma fila de texto. Pero muchos documentos de este estilo reparten los
// campos de una tarjeta en VARIAS filas (nombre en una línea, ticker +
// descripción en otra, peso en otra, importe en otra...), y agrupar
// únicamente por coordenada Y intercala de forma impredecible las filas de
// una tarjeta con las de la tarjeta vecina — las alturas de línea de ambas
// columnas casi nunca coinciden con precisión de un campo a otro. El
// resultado es que el nombre real de una posición (p.ej. "Broadcom") y sus
// propios datos (ticker, peso) terminan en líneas separadas por fragmentos
// de la tarjeta de al lado, y esa posición se pierde por completo en la
// extracción posterior.
//
// Señal para detectarlo: la misma que ya usa splitMergedColumnRow — un
// bloque de filas contiene alguna fila con dos o más tickers sueltos.
// Cuando se detecta, se reprocesa TODO el bloque (no solo esa fila):
//
// 1. Cada fragmento se clasifica por "tipo de campo": ticker, porcentaje,
//    importe, o texto libre (nombre/descripción).
// 2. Dentro de CADA tipo por separado, se separan sus propias coordenadas X
//    en izquierda/derecha buscando el mayor hueco entre valores. Nunca se
//    compara la X de un campo contra la X del ticker: en muchos documentos
//    la columna de peso/importe de la tarjeta izquierda cae, en valor
//    absoluto, más cerca del ticker DERECHO que del suyo propio, así que
//    un único umbral global produce asignaciones cruzadas.
// 3. Cada fragmento sin ticker se asocia a la tarjeta (ticker) más cercana
//    en Y que comparta su mismo lado izquierda/derecha, reconstruyendo el
//    texto completo de cada tarjeta en una única línea.
type FragKind = 'ticker' | 'percent' | 'amount' | 'text';

const PERCENT_ONLY_RE = /^-?[\d.,]+\s*%$/;
// Un importe suelto ("102 €/mes", "300€", "51 €/mes"): solo dígitos/
// puntuación más, opcionalmente, un símbolo/código de divisa y/o un
// sufijo de periodicidad ("/mes"). Exige que aparezca de verdad un símbolo
// de divisa o un sufijo de periodicidad para no confundirlo con cualquier
// número suelto sin relación con dinero.
const AMOUNT_ONLY_RE = /^-?[\d.,]+\s*(€|\$|£|EUR|USD|GBP)?\s*(\/\s*[a-zà-úñ]+)?$/i;

// Un nombre real de posición (empresa, fondo...) prácticamente nunca lleva
// "·": ese separador se usa en estos documentos solo dentro de frases
// descriptivas ("dividendo creciente · yield ~1.1%"). Sirve para distinguir
// una línea de nombre real de una de descripción a la hora de ordenar los
// campos de una tarjeta (ver bucketOf en reconstructPairedCardBlock).
const DESCRIPTIVE_FRAGMENT_RE_LOCAL = /·/;

function fragKind(str: string): FragKind {
  const t = str.trim();
  if (BARE_TICKER_RE.test(t) && !TICKER_LIKE_STOPLIST.has(t)) return 'ticker';
  if (PERCENT_ONLY_RE.test(t)) return 'percent';
  if (AMOUNT_ONLY_RE.test(t) && /[€$£]/.test(t)) return 'amount';
  if (/^-?[\d.,]+\s*\/\s*[a-zà-úñ]+$/i.test(t)) return 'amount'; // p.ej. "102 /mes" sin símbolo de divisa pegado
  return 'text';
}

// Separa un conjunto de coordenadas X en dos grupos (izquierda/derecha)
// buscando el mayor hueco entre valores consecutivos ya ordenados. Con
// menos de dos valores distintos, o si el mayor hueco es pequeño (ruido de
// maquetación dentro de un mismo lado, no una separación real de columnas),
// no hay separación fiable posible.
function splitByLargestGap(xs: number[]): number | null {
  const unique = Array.from(new Set(xs)).sort((a, b) => a - b);
  if (unique.length < 2) return null;
  let bestGap = -1;
  let bestIdx = -1;
  for (let i = 0; i < unique.length - 1; i++) {
    const gap = unique[i + 1]! - unique[i]!;
    if (gap > bestGap) {
      bestGap = gap;
      bestIdx = i;
    }
  }
  if (bestGap < 20) return null;
  return (unique[bestIdx]! + unique[bestIdx + 1]!) / 2;
}

function hasMultiTickerRow(rows: Row[]): boolean {
  return rows.some((r) => r.frags.filter((f) => fragKind(f.str) === 'ticker').length >= 2);
}

/** Reconstruye un bloque de filas con tarjetas en dos columnas: una línea de
 * texto completa por posición, con todos sus campos juntos y sin mezclar
 * los de la tarjeta vecina. Ver comentario de cabecera más arriba. */
function reconstructPairedCardBlock(rows: Row[]): string[] {
  interface Group {
    y: number;
    frags: Frag[];
    kind: FragKind;
    x: number;
  }
  const groups: Group[] = [];
  for (const row of rows) {
    const tickerCount = row.frags.filter((f) => fragKind(f.str) === 'ticker').length;
    if (tickerCount >= 2) {
      // Misma señal que splitMergedColumnRow: varios tickers en una única
      // fila. Reutilizamos su corte por posición de ticker tal cual.
      for (const sub of splitMergedColumnRow(row.frags)) {
        const tickerFrag = sub.find((f) => fragKind(f.str) === 'ticker');
        groups.push({ y: row.y, frags: sub, kind: 'ticker', x: (tickerFrag ?? sub[0]!).x });
      }
    } else {
      // Ninguna o una sola posición se anuncia con ticker en esta fila:
      // cada fragmento se trata como un dato suelto e independiente, a
      // reasociar por Y con la tarjeta que le corresponda.
      for (const f of row.frags) {
        groups.push({ y: row.y, frags: [f], kind: fragKind(f.str), x: f.x });
      }
    }
  }

  const anchors = groups.filter((g) => g.kind === 'ticker');
  if (anchors.length === 0) {
    // No debería ocurrir (solo se llega aquí cuando alguna fila del bloque
    // trajo 2+ tickers), pero por seguridad se cae al modo plano habitual.
    return rows.map((r) =>
      r.frags
        .slice()
        .sort((a, b) => a.x - b.x)
        .map((f) => f.str)
        .join(' ')
        .replace(/\s{2,}/g, '  '),
    );
  }

  // Umbral izquierda/derecha por TIPO de campo, calculado por separado para
  // cada tipo (ver comentario de cabecera): nunca se compara la X de un
  // peso/importe directamente contra la X de un ticker, porque en muchos
  // documentos la columna de peso/importe de la tarjeta izquierda cae, en
  // valor absoluto, más cerca del ticker derecho que del suyo propio. Esto
  // se usa exclusivamente para desempatar (ver más abajo) cuándo dos
  // tickers están a la misma distancia en Y de un dato suelto — nunca como
  // filtro previo a la distancia en Y, que es la señal principal y fiable
  // incluso cuando un dato comparte fila exactamente con su propio ticker.
  const thresholdByKind = new Map<FragKind, number | null>();
  for (const kind of ['ticker', 'percent', 'amount', 'text'] as FragKind[]) {
    thresholdByKind.set(kind, splitByLargestGap(groups.filter((g) => g.kind === kind).map((g) => g.x)));
  }
  function sideOf(g: Group): 'L' | 'R' | null {
    const threshold = thresholdByKind.get(g.kind) ?? null;
    if (threshold === null) return null;
    return g.x < threshold ? 'L' : 'R';
  }

  const extrasByAnchor = new Map<Group, (Frag & { y: number })[]>();
  for (const a of anchors) extrasByAnchor.set(a, []);

  // Una tolerancia pequeña en Y (unos pocos puntos) sirve para reconocer
  // "misma fila física" pese al redondeo de coordenadas ya aplicado antes.
  const TIE_EPSILON_Y = 8;
  for (const g of groups) {
    if (g.kind === 'ticker') continue; // los anclajes no se reasignan a sí mismos
    let best = anchors[0]!;
    let bestDist = Math.abs(g.y - best.y);
    for (const a of anchors) {
      const d = Math.abs(g.y - a.y);
      if (d < bestDist) {
        best = a;
        bestDist = d;
      }
    }
    // Si hay más de un ticker igual de cerca en Y (típicamente dos
    // tarjetas vecinas cuya fila de nombre, peso o descripción quedó
    // exactamente a la misma altura), se desempata por X: el tipo de dato
    // en concreto (nombre, peso...) sí guarda una relación de izquierda/
    // derecha consistente con el ticker que le corresponde cuando ambos
    // compiten a la misma distancia vertical.
    const tied = anchors.filter((a) => Math.abs(g.y - a.y) <= bestDist + TIE_EPSILON_Y);
    if (tied.length > 1) {
      const gSide = sideOf(g);
      const sameSide = gSide === null ? [] : tied.filter((a) => sideOf(a) === gSide);
      if (sameSide.length > 0) best = sameSide[0]!;
    }
    for (const f of g.frags) extrasByAnchor.get(best)!.push({ x: f.x, y: g.y, str: f.str });
  }

  // Orden final dentro de la línea de cada tarjeta: primero el texto que
  // parece un nombre real (sin "·", nunca lo lleva un nombre de empresa o
  // fondo), después el peso, después el importe, y al final el ticker con
  // cualquier descripción que traiga pegada. Así el primer número/
  // porcentaje que encuentra el analizador de texto llega siempre justo
  // después del nombre real — incluso en filas donde el peso quedó
  // pegado al ticker por coincidencia de coordenadas — evitando que la
  // descripción o el ticker contaminen el nombre extraído.
  // Un fragmento de texto que trae un "%" nunca es el nombre real de una
  // posición, aunque no encaje con el patrón estricto de "solo número y
  // %" (p.ej. "~1.1%", continuación envuelta de "yield ~1.1%" en otra
  // línea): sin esta comprobación, ese fragmento se cuela en el bucket de
  // nombre y desplaza el primer % real que ve el analizador de texto.
  function bucketOf(f: { str: string }, ownKind: FragKind): number {
    if (ownKind === 'text' && !DESCRIPTIVE_FRAGMENT_RE_LOCAL.test(f.str) && !f.str.includes('%')) return 0;
    if (ownKind === 'percent') return 1;
    if (ownKind === 'amount') return 2;
    return 3;
  }

  const sortedAnchors = anchors.slice().sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: string[] = [];
  for (const a of sortedAnchors) {
    const own = a.frags.map((f) => ({ x: f.x, y: a.y, str: f.str, bucket: 3 }));
    const extra = (extrasByAnchor.get(a) ?? []).map((f) => ({ ...f, bucket: bucketOf(f, fragKind(f.str)) }));
    const all = [...own, ...extra].sort((p, q) => p.bucket - q.bucket || q.y - p.y || p.x - q.x);
    lines.push(
      all
        .map((f) => f.str)
        .join(' ')
        .replace(/\s{2,}/g, '  '),
    );
  }
  return lines;
}

export function reconstructPageText(items: TextItemLike[]): string {
  // Agrupamos fragmentos por su coordenada Y (redondeada) para formar líneas,
  // y dentro de cada línea ordenamos por X para respetar el orden de columnas.
  const rows = new Map<number, Frag[]>();
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

  const sortedRows: Row[] = Array.from(rows.entries())
    .sort((a, b) => b[0] - a[0]) // Y descendente = de arriba a abajo
    .map(([y, frags]) => ({ y, frags }));

  if (sortedRows.length === 0) return '';

  // Las cabeceras de sección/título en este tipo de documento ("TECNOLOGÍA
  // — 5 EMPRESAS · 10%", el título del informe...) son siempre un único
  // fragmento pegado al margen izquierdo de la página — a diferencia del
  // contenido de cualquier tarjeta (ticker, nombre...), que siempre está
  // más indentado. Se usan como límites naturales de "bloque": dentro de un
  // mismo bloque (entre dos cabeceras, o desde el principio de la página
  // hasta la primera) es donde tiene sentido buscar y resolver tarjetas en
  // dos columnas, sin arrastrar la reconstrucción a secciones vecinas que
  // no tienen nada que ver. El margen se calcula de forma relativa (mínimo
  // X visto en la página + un margen de tolerancia), no con un valor fijo,
  // para no depender de la plantilla concreta de un documento.
  const pageMinX = Math.min(...sortedRows.flatMap((r) => r.frags.map((f) => f.x)));
  const isBoundaryRow = (r: Row) => r.frags.length === 1 && r.frags[0]!.x <= pageMinX + 15;

  const lines: string[] = [];
  let block: Row[] = [];
  const flushBlock = () => {
    if (block.length === 0) return;
    if (hasMultiTickerRow(block)) {
      lines.push(...reconstructPairedCardBlock(block));
    } else {
      for (const row of block) {
        for (const group of splitMergedColumnRow(row.frags)) {
          lines.push(
            group
              .map((f) => f.str)
              .join(' ')
              .replace(/\s{2,}/g, '  '),
          );
        }
      }
    }
    block = [];
  };

  for (const row of sortedRows) {
    if (isBoundaryRow(row)) {
      flushBlock();
      lines.push(row.frags[0]!.str);
    } else {
      block.push(row);
    }
  }
  flushBlock();

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
