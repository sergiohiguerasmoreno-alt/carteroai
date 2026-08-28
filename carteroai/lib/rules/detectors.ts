import type { RecommendationDraft, RuleContext } from './types';

/**
 * Cada detector implementa los pasos 3-6 del motor de decisión para un tipo
 * concreto de problema: ¿hay un problema real? ¿hay una mejora clara?
 * ¿compensa costes/riesgos? Solo entonces devuelve un draft de categoría
 * 'change' o 'remove'. Si el problema existe pero la evidencia no es
 * suficientemente sólida, el detector degrada la categoría a 'review' o
 * 'watch' en vez de forzar un cambio.
 */

const SINGLE_POSITION_REVIEW_THRESHOLD = 0.25;
const SINGLE_POSITION_CHANGE_THRESHOLD = 0.4;
const OVERLAP_WATCH_THRESHOLD = 0.3;
const OVERLAP_CHANGE_THRESHOLD = 0.5;
const TER_DIFFERENCE_FOR_CHANGE = 0.005; // 0.5 puntos porcentuales
const SUITABILITY_REVIEW_GAP = 0.15;
const SUITABILITY_CHANGE_GAP = 0.3;

export function detectConcentration(ctx: RuleContext): RecommendationDraft[] {
  const drafts: RecommendationDraft[] = [];
  for (const pc of ctx.positions) {
    if (pc.position.assetClass !== 'equity') continue;
    if (pc.weightPct < SINGLE_POSITION_REVIEW_THRESHOLD) continue;

    const isExperiencedHighTolerance = ctx.profile.experience === 'experienced' && ctx.profile.maxAcceptableLossPct >= 30;

    if (pc.weightPct >= SINGLE_POSITION_CHANGE_THRESHOLD && !isExperiencedHighTolerance) {
      drafts.push({
        category: 'change',
        targetPositionIds: [pc.position.id],
        targetLabel: pc.position.name,
        whatToChange: `Reducir el peso de "${pc.position.name}" hasta un nivel que no dependa el resultado global de la cartera de una sola empresa.`,
        why: `Esta posición representa el ${(pc.weightPct * 100).toFixed(0)}% de tu cartera. Tu perfil declarado (experiencia: ${ctx.profile.experience}, pérdida máxima aceptada: ${ctx.profile.maxAcceptableLossPct}%) no respalda una concentración de este nivel en un solo valor.`,
        problemSolved: 'Riesgo específico de empresa (riesgo idiosincrático) muy por encima de lo razonable para tu perfil.',
        riskReduced: 'Riesgo de concentración / riesgo específico de una única empresa.',
        riskIncreased: 'Ninguno directamente atribuible a esta reducción, salvo el riesgo de mercado general si el importe se reinvierte en otros activos.',
        portfolioImpact: `Reducir esta posición disminuiría notablemente la dependencia de la cartera de una sola empresa; el efecto exacto sobre la rentabilidad esperada no puede calcularse sin conocer el destino del capital liberado.`,
        alternative: 'Redistribuir gradualmente el exceso hacia posiciones más diversificadas (por ejemplo, ETFs de renta variable amplia) coherentes con tus preferencias declaradas.',
        evidence: [`Peso calculado: ${(pc.weightPct * 100).toFixed(1)}% del valor total de la cartera.`, 'Umbral de concentración de una sola posición: 40%.'],
        taxOrCostConsiderations: 'Vender esta posición puede generar una plusvalía o minusvalía fiscal. Verifica el impacto fiscal concreto antes de actuar; CarteroAI no calcula tu fiscalidad personal.',
        confidence: 'high',
        confidenceRationale: 'El peso de la posición es un dato calculado directamente de tu cartera confirmada, no una estimación.',
      });
    } else if (pc.weightPct >= SINGLE_POSITION_CHANGE_THRESHOLD && isExperiencedHighTolerance) {
      drafts.push({
        category: 'watch',
        targetPositionIds: [pc.position.id],
        targetLabel: pc.position.name,
        why: `Esta posición representa el ${(pc.weightPct * 100).toFixed(0)}% de tu cartera. Es una concentración elevada, pero coherente con tu experiencia inversora y tu tolerancia al riesgo declaradas.`,
        portfolioImpact: 'Un movimiento adverso de esta empresa concreta tendría un impacto grande y directo sobre el valor total de la cartera.',
        evidence: [`Peso calculado: ${(pc.weightPct * 100).toFixed(1)}%.`],
        confidence: 'medium',
        confidenceRationale: 'La adecuación a tu perfil de riesgo se basa en tus respuestas al cuestionario, que son una autoevaluación.',
      });
    } else {
      drafts.push({
        category: 'review',
        targetPositionIds: [pc.position.id],
        targetLabel: pc.position.name,
        why: `Esta posición representa el ${(pc.weightPct * 100).toFixed(0)}% de tu cartera, un nivel de concentración que merece que lo tengas presente sin que constituya, por sí solo, una razón suficiente para forzar un cambio.`,
        portfolioImpact: 'Aumenta la sensibilidad de la cartera a noticias específicas de esta empresa.',
        evidence: [`Peso calculado: ${(pc.weightPct * 100).toFixed(1)}%.`, 'Umbral de revisión: 25%.'],
        confidence: 'high',
        confidenceRationale: 'El peso es un dato calculado directamente, no estimado.',
      });
    }
  }
  return drafts;
}

export function detectOverlap(ctx: RuleContext): RecommendationDraft[] {
  const drafts: RecommendationDraft[] = [];
  const byName = new Map(ctx.positions.map((p) => [p.position.name, p]));

  for (const pair of ctx.diversification.overlapPairs) {
    if (pair.basis !== 'holdings_data') continue;
    const a = byName.get(pair.aName);
    const b = byName.get(pair.bName);
    if (!a || !b) continue;

    if (pair.overlapScore >= OVERLAP_CHANGE_THRESHOLD) {
      const cheaper = (a.terPct ?? Infinity) <= (b.terPct ?? Infinity) ? a : b;
      const pricier = cheaper === a ? b : a;
      const terGap = (pricier.terPct ?? 0) - (cheaper.terPct ?? 0);
      const hasCostEvidence = pricier.terPct !== undefined && cheaper.terPct !== undefined && terGap >= TER_DIFFERENCE_FOR_CHANGE;

      drafts.push({
        category: hasCostEvidence ? 'change' : 'review',
        targetPositionIds: [a.position.id, b.position.id],
        targetLabel: `${a.position.name} + ${b.position.name}`,
        whatToChange: hasCostEvidence
          ? `Consolidar "${pricier.position.name}" en "${cheaper.position.name}", que ofrece una exposición muy similar a menor coste.`
          : `Revisar si necesitas mantener ambos productos: "${a.position.name}" y "${b.position.name}".`,
        why: `Ambos productos comparten un solapamiento estimado del ${(pair.overlapScore * 100).toFixed(0)}% en sus principales posiciones (${pair.sharedTopHoldings.slice(0, 5).join(', ')}). Parte de la aparente diversificación entre ellos es ilusoria.`,
        problemSolved: 'Diversificación aparente: mantener dos productos con exposición muy solapada no reduce el riesgo tanto como parece.',
        riskReduced: hasCostEvidence ? 'Coste innecesario por duplicidad, sin ganancia real de diversificación.' : undefined,
        portfolioImpact: 'El perfil de riesgo/rentabilidad de la cartera apenas cambiaría al consolidar, porque la exposición ya es muy similar.',
        alternative: hasCostEvidence ? `Mantener únicamente "${cheaper.position.name}".` : 'Mantener ambos si cada uno cumple un propósito distinto en tu estrategia (por ejemplo, distinta política de distribución o divisa de cobertura).',
        evidence: [
          `Solapamiento estimado por posiciones principales: ${(pair.overlapScore * 100).toFixed(0)}%.`,
          ...(hasCostEvidence ? [`Diferencia de TER: ${(terGap * 100).toFixed(2)} puntos porcentuales a favor de "${cheaper.position.name}".`] : ['TER de uno o ambos productos no disponible: no se puede cuantificar el ahorro de coste con certeza.']),
        ],
        taxOrCostConsiderations: hasCostEvidence
          ? 'Vender la posición más cara puede generar una plusvalía o minusvalía fiscal. Verifica el impacto fiscal antes de actuar.'
          : undefined,
        confidence: hasCostEvidence ? 'high' : 'medium',
        confidenceRationale: hasCostEvidence
          ? 'El solapamiento y la diferencia de coste están basados en datos de composición y TER obtenidos de fuentes externas.'
          : 'El solapamiento está confirmado, pero falta el dato de coste (TER) de al menos uno de los productos para cuantificar el beneficio del cambio con certeza.',
      });
    } else if (pair.overlapScore >= OVERLAP_WATCH_THRESHOLD) {
      drafts.push({
        category: 'watch',
        targetPositionIds: [a.position.id, b.position.id],
        targetLabel: `${a.position.name} + ${b.position.name}`,
        why: `Solapamiento moderado (${(pair.overlapScore * 100).toFixed(0)}%) entre ambos productos. No es lo bastante alto como para recomendar un cambio, pero conviene ser consciente de que no diversifican entre sí tanto como parece.`,
        portfolioImpact: 'Limitado por ahora; podría ser relevante si decides ampliar posiciones en cualquiera de los dos productos.',
        evidence: [`Solapamiento estimado: ${(pair.overlapScore * 100).toFixed(0)}%.`],
        confidence: 'medium',
        confidenceRationale: 'Solapamiento estimado a partir únicamente de las principales posiciones disponibles de cada producto, no de su composición completa.',
      });
    }
  }
  return drafts;
}

export function detectCost(ctx: RuleContext): RecommendationDraft[] {
  // Coste elevado de un fondo/ETF concreto, sin que exista ya un comparador
  // más barato en la propia cartera (eso lo cubre detectOverlap). Aquí solo
  // señalamos, sin forzar cambio, cuando el TER de una posición individual
  // es marcadamente alto en términos absolutos.
  const drafts: RecommendationDraft[] = [];
  for (const pc of ctx.positions) {
    if ((pc.position.assetClass !== 'etf' && pc.position.assetClass !== 'fund') || pc.terPct === undefined) continue;
    if (pc.terPct >= 0.015 && pc.weightPct >= 0.08) {
      drafts.push({
        category: 'review',
        targetPositionIds: [pc.position.id],
        targetLabel: pc.position.name,
        why: `Este producto tiene un TER del ${(pc.terPct * 100).toFixed(2)}%, notablemente por encima de lo habitual en ETFs/fondos indexados comparables, y representa un ${(pc.weightPct * 100).toFixed(0)}% de tu cartera.`,
        problemSolved: undefined,
        portfolioImpact: `Un coste anual del ${(pc.terPct * 100).toFixed(2)}% detrae rentabilidad de forma sistemática cada año, especialmente relevante en horizontes largos.`,
        alternative: 'Valorar si existe una alternativa de menor coste con exposición equivalente, sin descartar que el coste esté justificado por gestión activa, acceso a un mercado específico o resultados históricos diferenciales.',
        evidence: [`TER: ${(pc.terPct * 100).toFixed(2)}%.`, `Peso en cartera: ${(pc.weightPct * 100).toFixed(0)}%.`],
        confidence: 'medium',
        confidenceRationale: 'El TER es un dato de fuente externa; no se ha podido contrastar contra una alternativa concreta con exposición idéntica, por lo que no se recomienda un cambio directo, solo revisar.',
      });
    }
  }
  return drafts;
}

export function detectSuitabilityGap(ctx: RuleContext): RecommendationDraft[] {
  const { suitability, profile } = ctx;
  if (suitability.withinBand) return [];

  const gap =
    suitability.growthWeight < suitability.band.minGrowthWeight
      ? suitability.band.minGrowthWeight - suitability.growthWeight
      : suitability.growthWeight - suitability.band.maxGrowthWeight;

  const direction = suitability.growthWeight < suitability.band.minGrowthWeight ? 'conservadora' : 'agresiva';

  if (gap >= SUITABILITY_CHANGE_GAP) {
    return [
      {
        category: 'change',
        targetPositionIds: [],
        targetLabel: 'Nivel de riesgo global de la cartera',
        whatToChange: `Acercar gradualmente el peso de activos de crecimiento (renta variable/ETFs de RV) hacia el rango orientativo del ${(suitability.band.minGrowthWeight * 100).toFixed(0)}-${(suitability.band.maxGrowthWeight * 100).toFixed(0)}%.`,
        why: `Tu cartera es notablemente más ${direction} de lo que sugiere tu horizonte (~${profile.horizonYearsApprox} años) y tu tolerancia al riesgo declarada (pérdida máxima aceptada: ${profile.maxAcceptableLossPct}%).`,
        problemSolved:
          direction === 'conservadora'
            ? 'Riesgo de no alcanzar el crecimiento necesario para tu objetivo en el horizonte disponible (riesgo de "quedarse corto"), y pérdida de poder adquisitivo frente a la inflación.'
            : 'Riesgo de sufrir una caída superior a la que declaras poder tolerar, con el riesgo añadido de vender en el peor momento.',
        riskReduced: direction === 'agresiva' ? 'Riesgo de pérdida máxima por encima de tu tolerancia declarada.' : undefined,
        riskIncreased: direction === 'conservadora' ? 'Volatilidad a corto plazo (a cambio de mayor potencial de crecimiento a largo plazo).' : undefined,
        portfolioImpact: 'Cambia el perfil de riesgo/rentabilidad esperado de toda la cartera, no de una posición concreta.',
        alternative: 'Ajustar el peso de forma gradual (por ejemplo, con nuevas aportaciones) en vez de un cambio brusco de un día para otro.',
        evidence: [
          `Peso actual en activos de crecimiento: ${(suitability.growthWeight * 100).toFixed(0)}%.`,
          `Rango orientativo para tu perfil: ${(suitability.band.minGrowthWeight * 100).toFixed(0)}-${(suitability.band.maxGrowthWeight * 100).toFixed(0)}%.`,
        ],
        confidence: 'medium',
        confidenceRationale: 'Se basa en un modelo orientativo estándar de planificación (horizonte + tolerancia declarada), no en una fórmula única ni en tu situación patrimonial completa.',
      },
    ];
  }
  if (gap >= SUITABILITY_REVIEW_GAP) {
    return [
      {
        category: 'review',
        targetPositionIds: [],
        targetLabel: 'Nivel de riesgo global de la cartera',
        why: `El peso en activos de crecimiento (${(suitability.growthWeight * 100).toFixed(0)}%) se sitúa algo fuera del rango orientativo (${(suitability.band.minGrowthWeight * 100).toFixed(0)}-${(suitability.band.maxGrowthWeight * 100).toFixed(0)}%) para tu horizonte y tolerancia declarados.`,
        portfolioImpact: 'Desviación moderada; no implica necesariamente un problema si es una decisión consciente.',
        evidence: [`Peso en activos de crecimiento: ${(suitability.growthWeight * 100).toFixed(0)}%.`],
        confidence: 'medium',
        confidenceRationale: 'Basado en un modelo orientativo, no en una regla exacta.',
      },
    ];
  }
  return [];
}

export function detectExclusionConflicts(ctx: RuleContext): RecommendationDraft[] {
  const drafts: RecommendationDraft[] = [];
  if (ctx.profile.preferences.exclusions.length === 0) return drafts;

  for (const pc of ctx.positions) {
    const nameUpper = pc.position.name.toUpperCase();
    for (const exclusion of ctx.profile.preferences.exclusions) {
      const term = exclusion.trim().toUpperCase();
      if (term.length >= 3 && nameUpper.includes(term)) {
        drafts.push({
          category: 'review',
          targetPositionIds: [pc.position.id],
          targetLabel: pc.position.name,
          why: `El nombre de esta posición contiene "${exclusion}", que mencionaste como una exclusión preferida. No se ha podido verificar automáticamente si supone un conflicto real con tu restricción.`,
          portfolioImpact: 'Ninguno cuantificado; revisión manual necesaria.',
          evidence: [`Coincidencia textual con la exclusión declarada: "${exclusion}".`],
          confidence: 'low',
          confidenceRationale: 'Es una coincidencia de texto, no un análisis de la actividad real de la empresa o fondo: puede ser un falso positivo.',
        });
        break;
      }
    }
  }
  return drafts;
}
