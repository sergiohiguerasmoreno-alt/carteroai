# CarteroAI

**Análisis inteligente y personalizado de carteras de inversión.**

CarteroAI lee el PDF de tu cartera, te hace las preguntas imprescindibles sobre tu
situación como inversor y te entrega un informe honesto: composición, diversificación,
riesgo, rentabilidad y recomendaciones — cada una con su razón, su evidencia y su nivel
de confianza. Si la cartera ya está bien construida para tus objetivos, la aplicación lo
dice claramente y no inventa cambios para parecer útil.

> **Principio central: "no cambiar por cambiar".** Ninguna recomendación de modificar,
> vender o sustituir un activo aparece sin una razón suficientemente sólida. Ver
> [`lib/rules`](./lib/rules) para la implementación de este principio.

---

## Índice

1. [Filosofía y principios de producto](#filosofía-y-principios-de-producto)
2. [Arquitectura](#arquitectura)
3. [Stack técnico y por qué](#stack-técnico-y-por-qué)
4. [Estructura del proyecto](#estructura-del-proyecto)
5. [Puesta en marcha (desarrollo)](#puesta-en-marcha-desarrollo)
6. [Variables de entorno](#variables-de-entorno)
7. [Tests](#tests)
8. [Build de producción](#build-de-producción)
9. [Despliegue](#despliegue)
10. [Seguridad y privacidad](#seguridad-y-privacidad)
11. [Aspectos legales](#aspectos-legales)
12. [Limitaciones conocidas](#limitaciones-conocidas)
13. [Extender la aplicación](#extender-la-aplicación)

---

## Filosofía y principios de producto

- **No cambiar por cambiar.** Una recomendación de "cambiar" o "eliminar" solo se genera
  cuando existe evidencia suficiente. El motor de decisión (`lib/rules`) sigue un proceso
  explícito de 6 pasos (fiabilidad de los datos → coherencia con el perfil → ¿hay un
  problema real? → ¿hay una mejora clara? → ¿compensa el coste/riesgo? → solo entonces,
  recomendar) antes de sugerir cualquier cambio.
- **Los cálculos los hace el código, no el modelo de lenguaje.** Pesos, rentabilidad,
  volatilidad, drawdown, solapamiento entre ETFs, TER ponderado y concentración se
  calculan matemáticamente en `lib/calculations`. La IA (`lib/ai`) solo interpreta y
  redacta a partir de esos hechos ya calculados — nunca calcula ni inventa una cifra.
  Como salvaguarda adicional, `lib/ai/fact-guard.ts` descarta cualquier texto generado
  por IA que mencione una cifra que no esté en los hechos que se le entregaron.
- **Nunca se inventan datos.** Si un dato de mercado no está disponible (falta de
  proveedor configurado, símbolo no resuelto, histórico insuficiente...), la interfaz y
  el informe lo dicen explícitamente en vez de rellenar un valor plausible.
- **La cantidad de cambios recomendados no es un objetivo.** Una cartera puede terminar
  el análisis con 0 recomendaciones de cambio. Es el resultado esperado, no un fallo.

## Arquitectura

El sistema separa explícitamente cuatro responsabilidades (encargo del proyecto, punto 27):

```
PDF ──► lib/parsing        Extracción heurística de posiciones (código, no IA)
        lib/market-data    Datos objetivos de mercado (proveedores intercambiables)
        lib/calculations   Cálculos matemáticos puros (pesos, riesgo, coste, score…)
        lib/rules          Motor de decisión determinista ("no cambiar por cambiar")
        lib/ai             Interpretación y redacción del resumen ejecutivo (Claude)
        lib/analysis       Orquestador: combina todo lo anterior en un PortfolioAnalysis
```

### Flujo de una petición de análisis

1. El usuario sube un PDF → `POST /api/upload` extrae texto (`pdfjs-dist`) y aplica
   heurísticas (`lib/parsing/position-extractor.ts`) para detectar posiciones, ISIN,
   ticker, cantidad, precio, divisa y peso. Todo en memoria; el archivo nunca se
   escribe a disco.
   Las posiciones extraídas se dan por buenas automáticamente: no hay una pantalla de
   confirmación manual. Si la extracción no identifica ninguna posición usable, se
   informa con un error y se pide otro archivo en vez de continuar con una cartera
   vacía; si algunas posiciones tienen confianza baja, ese aviso viaja con el análisis
   y aparece en el informe final (sección "Fuentes utilizadas" → "Limitaciones de
   datos"), para que el usuario las pueda verificar sin necesidad de un paso previo.
2. El usuario responde un cuestionario corto y adaptativo (`lib/questions`) sobre
   objetivo, horizonte, riesgo, liquidez, aportaciones y preferencias.
3. `POST /api/analyze` recibe la cartera y el perfil, y ejecuta el pipeline
   completo: tipos de cambio → valoración → composición → diversificación → riesgo →
   rentabilidad/benchmark → coste → score → motor de reglas → escenarios → resumen
   ejecutivo (IA con salvaguarda anti-alucinación). Devuelve un `PortfolioAnalysis`
   completo. **No se persiste nada en el servidor.**
4. `POST /api/report/pdf` recibe ese mismo análisis ya calculado y lo maqueta en un PDF
   descargable (`@react-pdf/renderer`) — no repite ningún cálculo.

La aplicación es **sin estado en el servidor**: toda la cartera, respuestas y análisis
viven únicamente en la memoria del navegador durante la sesión. Esto es deliberado por
privacidad (punto 23 del encargo) y simplifica el despliegue (sin base de datos que
mantener en la v1). Ver [Extender la aplicación](#extender-la-aplicación) para cómo
añadir persistencia en el futuro sin rehacer el resto del sistema.

## Stack técnico y por qué

| Decisión | Por qué |
|---|---|
| **Next.js 14 (App Router) + TypeScript** | Frontend y backend en un único proyecto desplegable en Vercel con un solo comando; API routes con runtime Node.js para el procesamiento de PDF y llamadas a proveedores externos; evita mantener dos repositorios/servicios para una v1. |
| **Tailwind CSS** | Diseño consistente y con mucho espacio en blanco sin arrastrar una librería de componentes genérica que imponga su propia estética. |
| **Zod** | Validación de todo lo que llega a las rutas de API (la cartera y el perfil los controla el cliente; nunca se confía en su forma sin validar). |
| **pdfjs-dist** | Extracción de texto de PDF con control fino de la posición (x, y) de cada fragmento, necesario para reconstruir líneas tabulares con fiabilidad. Se evitó `pdf-parse` por ser un envoltorio sin mantenimiento activo y frágil ante PDFs con tablas xref no estándar (confirmado durante las pruebas de este proyecto). |
| **Recharts** | Gráficos ligeros y accesibles (tooltips, leyenda, etiquetas directas) sin la complejidad de D3 a bajo nivel. Paleta categórica validada para daltonismo (ver `components/charts/palette.ts`). |
| **@react-pdf/renderer** | Generación del informe en PDF con el mismo lenguaje (React) que el resto de la aplicación, sin depender de un servicio externo de conversión HTML→PDF. |
| **@anthropic-ai/sdk (Claude)** | Única pieza de IA del sistema: redacta el resumen ejecutivo a partir de hechos ya calculados, con un prompt que prohíbe explícitamente introducir cifras nuevas, más una verificación posterior (`fact-guard.ts`). Si no hay clave configurada, un generador de texto determinista por plantillas cubre la misma función — **la aplicación funciona sin IA configurada**, con textos algo menos naturales pero igual de rigurosos. |
| **Stooq (precios) y Frankfurter (tipos de cambio)** | Fuentes gratuitas sin clave de API para que la aplicación sea útil desde el primer despliegue, sin depender de una clave de pago para lo esencial (precios históricos, volatilidad, drawdown, tipos de cambio). |
| **Financial Modeling Prep (opcional)** | Fundamentales de acciones y composición/TER de ETFs. Requiere clave de pago/gratuita propia; si no se configura, esas secciones del informe indican explícitamente "dato no disponible" en vez de omitirlo silenciosamente o inventarlo. |
| **Sin base de datos en la v1** | Ver "Arquitectura": la aplicación es sin estado por diseño. Añadir un almacén de análisis históricos es la ampliación más obvia (ver más abajo) pero no es necesaria para que la v1 sea completa y útil, y añadirla prematuramente introduciría superficie de ataque y mantenimiento sin necesidad real. |

## Estructura del proyecto

```
app/
  page.tsx                Landing (pantalla 1)
  analizar/page.tsx        Wizard cliente: sube → preguntas → email → informe
  legal/page.tsx           Aviso legal y privacidad
  api/
    upload/route.ts        Extracción de PDF (sin persistencia)
    analyze/route.ts        Orquesta el análisis completo
    report/pdf/route.ts     Genera el PDF descargable
components/
  flow/                    Pantallas del asistente (subida, preguntas, email…)
  report/                  Secciones del informe en pantalla
  charts/                  Gráficos (paleta validada, sin librería externa de temas)
lib/
  parsing/                 Extracción de texto y heurísticas de posiciones
  market-data/             Proveedores de datos de mercado, intercambiables
  calculations/             Cálculos puros (sin IA, sin efectos secundarios)
  rules/                   Motor de decisión "no cambiar por cambiar"
  ai/                      Interpretación por IA + salvaguarda anti-alucinación
  analysis/                Orquestador del pipeline completo
  questions/               Banco de preguntas y lógica condicional
  config/legal-flags.ts     Flags de funcionalidad según marco legal
  security/                Rate limiting básico y validación de subidas
  validation/schemas.ts     Esquemas Zod para las rutas de API
  pdf/report-document.tsx   Plantilla del informe en PDF
```

## Puesta en marcha (desarrollo)

Requisitos: Node.js ≥ 18.18 (recomendado 20+) y npm.

```bash
npm install
cp .env.example .env.local   # rellena lo que necesites (todo es opcional para arrancar)
npm run dev
```

Abre http://localhost:3000. La aplicación **funciona sin ninguna clave configurada**:
los precios/volatilidad/drawdown usan Stooq (sin clave) y el resumen ejecutivo usa un
generador determinista si no hay `ANTHROPIC_API_KEY`. Sin `FMP_API_KEY`, las secciones
de fundamentales y composición de ETFs mostrarán honestamente "dato no disponible".

## Variables de entorno

Ver [`.env.example`](./.env.example) para la lista completa y comentada. Ninguna clave
se usa nunca en código de cliente: todas se consumen exclusivamente en rutas de servidor
(`app/api/**` y módulos `server-only`).

| Variable | Obligatoria | Qué activa |
|---|---|---|
| `ANTHROPIC_API_KEY` | No | Resumen ejecutivo redactado por IA (si falta, fallback determinista) |
| `ANTHROPIC_MODEL` | No | Modelo a usar (por defecto `claude-sonnet-4-5`) |
| `FMP_API_KEY` | No | Fundamentales de acciones, TER y composición de ETFs/fondos |
| `SESSION_SECRET` | No (v1 sin sesiones) | Reservado para cuando se añada persistencia |
| `RATE_LIMIT_PER_MINUTE` | No | Límite de peticiones por IP a las rutas de API |
| `LEGAL_MODE` | No | `informational_only` (por defecto) o `licensed_advisory` — ver `lib/config/legal-flags.ts` |
| `NEXT_PUBLIC_MAX_UPLOAD_MB` | No | Tamaño máximo de PDF admitido (por defecto 15 MB) |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | No | Captación de leads: email de la cuenta de servicio de Google Cloud |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | No | Captación de leads: clave privada de esa cuenta de servicio |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | No | Captación de leads: ID de la Google Sheet donde se guardan los emails |
| `GOOGLE_SHEETS_SHEET_NAME` | No | Captación de leads: nombre de la pestaña (por defecto `Leads`) |

## Captación de emails (leads)

Justo antes de mostrar el informe, la aplicación pide el email del usuario (con una
casilla de consentimiento explícita) y lo guarda en una Google Sheet — es la **única
persistencia de toda la aplicación**: nunca se guarda la cartera, las respuestas del
cuestionario ni el informe, solo `timestamp`, `email`, `objective`, `horizonYearsApprox`
y `source`. Si las variables de Google no están configuradas, este paso sigue
funcionando (la UX nunca se bloquea por un fallo de captación) pero el email no se
persiste en ningún sitio, y el servidor deja constancia en sus logs de que el guardado
no está configurado.

Para activarlo:

1. En [Google Cloud Console](https://console.cloud.google.com/), crea o reutiliza un
   proyecto y habilita la **Google Sheets API**.
2. Crea una **cuenta de servicio** (IAM y administración → Cuentas de servicio) y
   genera para ella una clave en formato JSON.
3. Copia `client_email` del JSON a `GOOGLE_SERVICE_ACCOUNT_EMAIL` y el `private_key`
   completo (con los `\n` tal cual aparecen) a `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`.
4. Crea una Google Sheet nueva. En la pestaña indicada por `GOOGLE_SHEETS_SHEET_NAME`
   (por defecto `Leads`) añade la fila de cabecera: `timestamp | email | objective |
   horizonYearsApprox | source`.
5. Comparte esa Sheet con el email de la cuenta de servicio, con permiso de **Editor**.
6. Copia el ID de la Sheet (la parte de la URL entre `/d/` y `/edit`) en
   `GOOGLE_SHEETS_SPREADSHEET_ID`.

## Tests

```bash
npm run test        # vitest — cálculos, parsing y motor de reglas
npm run typecheck    # tsc --noEmit
npm run lint         # eslint (next/core-web-vitals)
```

Los tests cubren especialmente lo más sensible a errores silenciosos: el parseo de
números en formato europeo/anglosajón, la valoración y el cálculo de pesos de la
cartera, el modelo de adecuación al perfil de riesgo, y el motor de decisión —
incluyendo un test explícito que verifica que una cartera bien diversificada y
coherente con el perfil **no genera ninguna recomendación de cambio**.

## Build de producción

```bash
npm run build
npm start
```

## Despliegue

### Vercel (recomendado)

1. Sube este repositorio a GitHub.
2. Importa el repositorio en [vercel.com](https://vercel.com/new).
3. Vercel detecta Next.js automáticamente. No hace falta configuración adicional de
   build.
4. Configura las variables de entorno de la tabla anterior en *Project Settings →
   Environment Variables* (todas opcionales; la app funciona sin ninguna).
5. Despliega. La aplicación no requiere base de datos, cola de trabajos ni
   almacenamiento de archivos: es un despliegue Next.js estándar.

### Otros proveedores

Cualquier plataforma compatible con Next.js 14 (App Router, rutas de API con runtime
Node.js) sirve: Netlify, Railway, un contenedor Docker propio con `next start`, etc. Ten
en cuenta que `pdfjs-dist` y `@react-pdf/renderer` necesitan un runtime Node.js completo
(no Edge) — las rutas de API ya declaran `export const runtime = 'nodejs'`.

## Seguridad y privacidad

- El PDF subido se procesa **enteramente en memoria** y nunca se escribe en disco ni se
  registra en logs.
- La aplicación es sin estado: no hay base de datos ni almacenamiento de sesión donde
  pueda filtrarse la cartera de un usuario a otro.
- Los errores se registran en logs solo como mensajes técnicos genéricos (`err.message`),
  nunca con el contenido financiero de la petición.
- Cabeceras de seguridad (CSP, `X-Frame-Options`, `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy`) configuradas en `next.config.mjs`.
- Rate limiting básico por IP en las tres rutas de API (`lib/security/rate-limit.ts`).
  Es una protección de primera línea en memoria, adecuada para una instancia; para un
  límite estrictamente global en despliegues multi-instancia, sustituye ese módulo por
  uno respaldado por Redis/Upstash sin tocar el resto del código.
- Se valida la cabecera real del PDF (`%PDF-`), no solo su extensión o MIME declarado.
- Ninguna clave de API se expone jamás al cliente.

## Aspectos legales

CarteroAI genera **información y educación financiera mediante análisis automatizado**,
no asesoramiento de inversión personalizado en el sentido de MiFID II. Ver
[`app/legal/page.tsx`](./app/legal/page.tsx) y [`lib/config/legal-flags.ts`](./lib/config/legal-flags.ts).
El sistema de *flags* legales permite activar o desactivar el lenguaje de
"recomendación" según el marco regulatorio en el que se opere; **antes de comercializar
cualquier forma de asesoramiento personalizado en España, el marco legal debe revisarse
y adaptarse formalmente con asesoría jurídica — este proyecto no lo sustituye.**

## Limitaciones conocidas

- **Extracción de PDF por heurísticas, sin confirmación manual.** Funciona bien con
  extractos tabulares (nombre, ISIN, cantidad, precio, valor, peso), pero es
  heurística: nombres de producto que contienen números (p. ej. "S&P 500") pueden
  truncarse. Las posiciones extraídas se usan directamente, sin que el usuario las
  revise antes; las que se han leído con confianza baja se señalan en la sección
  "Limitaciones de datos" del informe final para que se puedan verificar contra el
  extracto original. Un PDF en prosa o escaneado como imagen, del que no se pueda
  extraer ninguna posición, se rechaza con un error pidiendo otro archivo — no hay
  forma de introducir posiciones manualmente en esta versión.
- **Resolución de ticker desde ISIN** solo funciona con `FMP_API_KEY` configurada; sin
  ella, una posición identificada solo por ISIN (típico de fondos/ETFs UCITS europeos)
  no tendrá datos de mercado externos, y el informe lo indica explícitamente.
- **Stooq** tiene buena cobertura de acciones y ETFs de EE. UU. y Europa, pero no de
  todos los fondos/ETFs UCITS. Sin histórico de precios, la volatilidad, el drawdown y
  la rentabilidad histórica de esa posición se muestran como "no disponible".
- **El modelo de "rango razonable de exposición a activos de crecimiento"**
  (`lib/calculations/suitability.ts`) es una heurística orientativa de planificación
  financiera habitual, no una fórmula regulatoria ni la única válida; se documenta como
  tal en el propio informe.
- Sin `ANTHROPIC_API_KEY`, el resumen ejecutivo usa un generador de texto por plantillas:
  correcto y honesto, pero menos natural que con IA.

## Extender la aplicación

La v1 es deliberadamente sin estado (ver Arquitectura). Para añadir seguimiento de
cartera a lo largo del tiempo (punto 14 del encargo original) sin rehacer el resto:

1. Añade una capa de persistencia (p. ej. Postgres vía Prisma, o Supabase) que guarde
   `Portfolio`, `InvestorProfile` y `PortfolioAnalysis` tal cual están tipados hoy en
   `lib/types` — los tipos ya están listos para serializarse.
2. Añade autenticación (p. ej. NextAuth/Auth.js) delante de las rutas que lean/escriban
   ese histórico.
3. El pipeline de análisis (`lib/analysis/orchestrator.ts`) no cambia: seguiría
   devolviendo un `PortfolioAnalysis` a partir de una cartera y un perfil, ahora también
   guardable.
4. Para alertas y revisión periódica, un cron (Vercel Cron o similar) que vuelva a
   ejecutar `analyzePortfolio` sobre carteras guardadas y compare el resultado con el
   análisis anterior es la extensión natural.

Para sustituir o añadir un proveedor de datos de mercado, implementa la misma forma de
`MarketDataBundle` en un nuevo archivo bajo `lib/market-data/providers/` y regístralo en
`lib/market-data/service.ts` — ninguna otra capa necesita cambios.

---

*CarteroAI es un análisis automatizado con fines informativos y educativos, no
asesoramiento financiero personalizado. Ver [aviso legal completo](./app/legal/page.tsx).*
