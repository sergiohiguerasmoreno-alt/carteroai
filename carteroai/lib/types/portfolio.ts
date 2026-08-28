/**
 * Modelo de datos de una posición y una cartera.
 *
 * Estos tipos representan HECHOS extraídos del PDF y, tras confirmación del
 * usuario, HECHOS confirmados. Ningún cálculo (peso, rentabilidad, etc.) se
 * hace aquí: ver lib/calculations. Ningún campo de este archivo lo rellena
 * la IA; lo rellena el parser (lib/parsing) o el propio usuario al corregir.
 */

export type AssetClass =
  | 'equity' // acción individual
  | 'etf'
  | 'fund' // fondo de inversión tradicional
  | 'bond'
  | 'cash'
  | 'crypto'
  | 'other';

export type ExtractionConfidence = 'high' | 'medium' | 'low';

export interface Position {
  /** Identificador estable dentro de la sesión de análisis (no persistente). */
  id: string;

  /** Texto tal cual apareció en el PDF, para trazabilidad y depuración. */
  rawLine?: string;

  /** Nombre del activo, editable por el usuario en la pantalla de confirmación. */
  name: string;

  ticker?: string;
  isin?: string;
  assetClass: AssetClass;

  /** Número de unidades/participaciones, si el PDF lo indica. */
  quantity?: number;

  /** Precio unitario en la divisa nativa del activo. */
  price?: number;

  /** Divisa del precio/valor de la posición (ISO 4217, p.ej. EUR, USD). */
  currency?: string;

  /** Valor de mercado de la posición en su divisa nativa (quantity * price si no viene explícito). */
  marketValue?: number;

  /** Peso dentro de la cartera tal y como aparece en el PDF (0-1). Puede diferir del calculado. */
  weightAsStated?: number;

  /** Sector GICS aproximado, cuando se puede determinar. Lo aporta market-data, no el parser. */
  sector?: string;

  /** Región/país predominante. Lo aporta market-data, no el parser. */
  geography?: string;

  extractionConfidence: ExtractionConfidence;

  /** true una vez que el usuario ha revisado/confirmado esta fila. */
  userConfirmed: boolean;

  /** true si el usuario modificó manualmente algún campo tras la extracción automática. */
  userEdited: boolean;
}

export interface Portfolio {
  id: string;
  positions: Position[];

  /** Divisa base para agregados de la cartera (normalmente la más frecuente o la elegida por el usuario). */
  baseCurrency: string;

  /** Nombre original del archivo, solo para mostrarlo en pantalla; nunca se persiste. */
  sourceFileName: string;

  /** Marca de tiempo de la extracción (no de creación de la cartera real). */
  extractedAt: string;

  /** Avisos del parser: ambigüedades, líneas descartadas, totales que no cuadran, etc. */
  extractionWarnings: string[];
}

/** Cartera tras el paso de confirmación del usuario: mismo shape, pero se exige userConfirmed=true en todas las filas. */
export type ConfirmedPortfolio = Portfolio;
