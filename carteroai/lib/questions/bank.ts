import type { QuestionGroup } from './types';

/**
 * Banco de preguntas. Solo lo estrictamente necesario para evaluar la
 * cartera (item 4 del encargo): objetivo, horizonte, riesgo, liquidez,
 * aportaciones, preferencias y situación. Cada grupo es una pantalla; las
 * subpreguntas condicionales solo aparecen cuando son relevantes.
 */
export const QUESTION_GROUPS: QuestionGroup[] = [
  {
    id: 'objective',
    title: '¿Cuál es el objetivo principal de esta cartera?',
    subtitle: 'Elige la opción que mejor represente para qué estás invirtiendo este dinero.',
    questions: [
      {
        id: 'objective',
        type: 'single_choice',
        title: 'Objetivo principal',
        required: true,
        options: [
          { value: 'wealth_growth', label: 'Crecimiento de patrimonio a largo plazo' },
          { value: 'retirement', label: 'Jubilación' },
          { value: 'income', label: 'Generar ingresos periódicos' },
          { value: 'capital_preservation', label: 'Preservar el capital' },
          { value: 'home_purchase', label: 'Comprar una vivienda' },
          { value: 'financial_independence', label: 'Independencia financiera' },
          { value: 'other', label: 'Otro' },
        ],
      },
      {
        id: 'objectiveOther',
        type: 'text',
        title: 'Cuéntanos brevemente cuál es tu objetivo',
        required: true,
        condition: (a) => a.objective === 'other',
      },
    ],
  },
  {
    id: 'horizon',
    title: '¿Con qué horizonte temporal inviertes?',
    subtitle: 'Aproximado está bien — no hace falta una cifra exacta.',
    questions: [
      {
        id: 'horizonYearsApprox',
        type: 'number',
        title: 'Años aproximados hasta que necesites usar este dinero',
        helpText: 'Si es "para siempre" o no tienes fecha concreta, indica un número alto (por ejemplo, 20).',
        required: true,
        min: 0,
        max: 50,
        step: 1,
        unit: 'años',
      },
    ],
  },
  {
    id: 'risk',
    title: 'Tu relación con el riesgo',
    subtitle: 'No hay respuestas correctas: nos ayuda a entender qué nivel de oscilación puedes soportar sin tomar decisiones precipitadas.',
    questions: [
      {
        id: 'maxAcceptableLossPct',
        type: 'number',
        title: '¿Qué caída máxima de tu cartera en un mal año podrías soportar sin agobiarte?',
        helpText: 'Piensa en un porcentaje sobre el total invertido, por ejemplo 10%, 20%, 30%...',
        required: true,
        min: 0,
        max: 80,
        step: 5,
        unit: '%',
      },
      {
        id: 'reactionToDrop',
        type: 'single_choice',
        title: 'Si tu cartera cayera un 25% en pocos meses, ¿qué harías probablemente?',
        required: true,
        options: [
          { value: 'sell_immediately', label: 'Vendería la mayor parte para frenar pérdidas' },
          { value: 'sell_some', label: 'Vendería una parte' },
          { value: 'do_nothing', label: 'No haría nada, esperaría' },
          { value: 'buy_more', label: 'Aprovecharía para invertir más' },
        ],
      },
      {
        id: 'experience',
        type: 'single_choice',
        title: '¿Cómo describirías tu experiencia como inversor?',
        required: true,
        options: [
          { value: 'beginner', label: 'Principiante' },
          { value: 'intermediate', label: 'Intermedia' },
          { value: 'experienced', label: 'Experimentada' },
        ],
      },
    ],
  },
  {
    id: 'liquidity',
    title: 'Necesidades de liquidez',
    subtitle: 'Nos interesa saber si podrías necesitar retirar parte del dinero antes de lo previsto.',
    questions: [
      {
        id: 'mayNeedWithdrawal',
        type: 'boolean',
        title: '¿Podrías necesitar retirar una parte relevante de esta cartera antes de tu horizonte previsto?',
        required: true,
      },
      {
        id: 'liquidityTimeframeYears',
        type: 'number',
        title: '¿En cuántos años, aproximadamente, podrías necesitar ese dinero?',
        required: true,
        min: 0,
        max: 30,
        step: 1,
        unit: 'años',
        condition: (a) => a.mayNeedWithdrawal === true,
      },
      {
        id: 'liquidityApproxShare',
        type: 'single_choice',
        title: '¿Qué parte aproximada de la cartera podrías necesitar retirar?',
        required: true,
        condition: (a) => a.mayNeedWithdrawal === true,
        options: [
          { value: '0.1', label: 'Menos del 15%' },
          { value: '0.3', label: 'Entre el 15% y el 40%' },
          { value: '0.6', label: 'Más del 40%' },
        ],
      },
    ],
  },
  {
    id: 'contributions',
    title: 'Aportaciones futuras',
    subtitle: '¿Sigues invirtiendo de forma periódica en esta cartera?',
    questions: [
      {
        id: 'makesRecurringContributions',
        type: 'boolean',
        title: '¿Realizas aportaciones periódicas a esta cartera?',
        required: true,
      },
      {
        id: 'contributionFrequency',
        type: 'single_choice',
        title: '¿Con qué frecuencia?',
        required: true,
        condition: (a) => a.makesRecurringContributions === true,
        options: [
          { value: 'monthly', label: 'Mensual' },
          { value: 'quarterly', label: 'Trimestral' },
          { value: 'annual', label: 'Anual' },
          { value: 'irregular', label: 'Irregular' },
        ],
      },
      {
        id: 'contributionAmountBucket',
        type: 'single_choice',
        title: '¿Qué importe aproximado aportas, en relación con el tamaño actual de tu cartera?',
        required: true,
        condition: (a) => a.makesRecurringContributions === true,
        options: [
          { value: 'low', label: 'Poco significativo (menos del 2% del total al año)' },
          { value: 'medium', label: 'Moderado (entre el 2% y el 10% al año)' },
          { value: 'high', label: 'Elevado (más del 10% al año)' },
        ],
      },
    ],
  },
  {
    id: 'preferences',
    title: 'Preferencias y restricciones',
    subtitle: 'Opcional, pero nos ayuda a que las recomendaciones respeten tus preferencias.',
    questions: [
      {
        id: 'vehicles',
        type: 'multi_choice',
        title: '¿Tienes preferencia por algún tipo de vehículo de inversión?',
        required: false,
        options: [
          { value: 'etf', label: 'ETFs' },
          { value: 'stocks', label: 'Acciones individuales' },
          { value: 'funds', label: 'Fondos de inversión' },
          { value: 'bonds', label: 'Renta fija' },
          { value: 'no_preference', label: 'Sin preferencia' },
        ],
      },
      {
        id: 'esgFocus',
        type: 'boolean',
        title: '¿Te importa que la cartera tenga criterios ESG/sostenibilidad?',
        required: false,
      },
      {
        id: 'dividendFocus',
        type: 'boolean',
        title: '¿Priorizas activos que reparten dividendos?',
        required: false,
      },
      {
        id: 'exclusions',
        type: 'text',
        title: '¿Hay sectores, países o empresas que prefieras excluir?',
        helpText: 'Por ejemplo: tabaco, armamento, un país concreto. Déjalo en blanco si no aplica.',
        required: false,
      },
    ],
  },
  {
    id: 'situation',
    title: 'Algo más que debamos saber',
    subtitle: 'Opcional. Cualquier circunstancia relevante que pueda afectar a la recomendación.',
    questions: [
      {
        id: 'situationNotes',
        type: 'text',
        title: 'Cuéntanoslo brevemente (opcional)',
        required: false,
      },
    ],
  },
];
