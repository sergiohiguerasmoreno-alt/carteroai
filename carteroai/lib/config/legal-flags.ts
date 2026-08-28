/**
 * CarteroAI genera análisis automatizados con fines informativos y de
 * educación financiera. NO constituye asesoramiento en materia de
 * inversión en el sentido de la normativa MiFID II / Ley del Mercado de
 * Valores española, que en España exige estar habilitado ante la CNMV
 * (como empresa de servicios de inversión, agente o asesor financiero
 * independiente registrado) para prestar recomendaciones personalizadas
 * de compra/venta de instrumentos financieros concretos.
 *
 * Este archivo centraliza qué funcionalidades están activas según el modo
 * legal configurado, para poder adaptar el producto a distintos marcos
 * regulatorios sin tocar el resto del código. Por defecto, todas las
 * instalaciones arrancan en modo "informational_only".
 */

export type LegalMode = 'informational_only' | 'licensed_advisory';

export interface LegalFeatureFlags {
  mode: LegalMode;
  /** Si es false, el lenguaje de "recomendación" se sustituye por "para tu consideración" en el frontend. */
  allowRecommendationLanguage: boolean;
  /** Si es false, no se permite conectar la app a la ejecución real de órdenes (no implementado en esta versión). */
  allowOrderExecution: boolean;
  /** Texto legal a mostrar de forma destacada. */
  disclaimerLevel: 'standard' | 'strict';
}

export function getLegalFlags(): LegalFeatureFlags {
  const mode = (process.env.LEGAL_MODE as LegalMode) || 'informational_only';

  if (mode === 'licensed_advisory') {
    // Reservado para una futura versión operada por una entidad habilitada.
    // No activar sin verificación legal previa.
    return {
      mode,
      allowRecommendationLanguage: true,
      allowOrderExecution: false,
      disclaimerLevel: 'standard',
    };
  }

  return {
    mode: 'informational_only',
    allowRecommendationLanguage: false,
    allowOrderExecution: false,
    disclaimerLevel: 'strict',
  };
}

export const DISCLAIMER_TEXT = `CarteroAI es una herramienta de información y educación financiera que utiliza análisis automatizado (cálculos y modelos de apoyo, incluida inteligencia artificial para la interpretación de resultados). No constituye asesoramiento de inversión personalizado ni una recomendación de compra o venta de ningún instrumento financiero conforme a la normativa MiFID II. CarteroAI no está registrada como empresa de servicios de inversión ni como asesor financiero ante la CNMV. La información se ofrece "tal cual", puede contener errores de extracción o de datos de mercado, y no debe ser tu única base para tomar decisiones de inversión. La rentabilidad pasada no garantiza rentabilidad futura. Antes de tomar decisiones relevantes, considera consultar con un asesor financiero, fiscal o legal debidamente habilitado.`;
