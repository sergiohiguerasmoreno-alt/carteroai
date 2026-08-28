import Link from 'next/link';

const PRINCIPLES = [
  {
    title: 'No cambiamos tu cartera por cambiarla',
    body: 'Si tu cartera ya está bien construida para tus objetivos, te lo decimos claramente. Cada cambio que sí recomendamos lleva su razón, su evidencia y su nivel de confianza.',
  },
  {
    title: 'Datos reales, nunca inventados',
    body: 'Consultamos fuentes de mercado actualizadas para precios, fundamentales y composición de ETFs. Si un dato no está disponible, te lo decimos en vez de rellenarlo.',
  },
  {
    title: 'Cálculo por código, no por intuición de un modelo',
    body: 'Pesos, volatilidad, drawdown, solapamiento entre ETFs y coste ponderado se calculan matemáticamente. La IA solo interpreta y explica los resultados ya calculados.',
  },
];

export default function LandingPage() {
  return (
    <main>
      <header className="container-app flex items-center justify-between py-6">
        <span className="font-serif text-lg font-semibold tracking-tight text-ink-950">CarteroAI</span>
        <Link href="/analizar" className="btn-ghost">
          Analiza mi cartera →
        </Link>
      </header>

      <section className="container-app pb-16 pt-10 sm:pb-24 sm:pt-16">
        <p className="label-sm mb-5 text-signal-teal">Análisis de carteras con IA</p>
        <h1 className="font-serif text-4xl leading-[1.1] tracking-tight text-ink-950 sm:text-6xl">
          Entiende tu cartera de verdad.
          <br />
          <span className="text-ink-500">Y sabe qué hacer con ella —</span>
          <br />
          <span className="text-ink-500">incluso si es no hacer nada.</span>
        </h1>
        <p className="mt-7 max-w-xl text-base leading-relaxed text-ink-600 sm:text-lg">
          Sube el PDF de tu cartera de inversión. CarteroAI identifica tus posiciones, consulta información de
          mercado actualizada, te hace unas preguntas breves sobre tu situación y te entrega un análisis profundo y
          accionable — sin recomendarte cambios que no estén respaldados por una razón sólida.
        </p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <Link href="/analizar" className="btn-primary">
            Analiza mi cartera
          </Link>
          <a href="#como-funciona" className="btn-secondary">
            Cómo funciona
          </a>
        </div>
        <p className="mt-5 text-xs text-ink-400">
          Tu PDF se procesa en memoria y no se almacena. Análisis con fines informativos y educativos — no es
          asesoramiento financiero personalizado. Ver aviso legal completo.
        </p>
      </section>

      <section id="como-funciona" className="border-t border-ink-100 bg-white py-16 sm:py-24">
        <div className="container-app">
          <p className="label-sm mb-3 text-ink-400">Filosofía</p>
          <h2 className="mb-10 max-w-lg font-serif text-2xl text-ink-950 sm:text-3xl">
            &ldquo;No te recomendamos cambiar tu cartera para darte más recomendaciones. Te la recomendamos cambiar
            cuando existe una buena razón.&rdquo;
          </h2>
          <div className="grid gap-8 sm:grid-cols-3">
            {PRINCIPLES.map((p) => (
              <div key={p.title}>
                <h3 className="mb-2 text-sm font-semibold text-ink-950">{p.title}</h3>
                <p className="text-sm leading-relaxed text-ink-600">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-24">
        <div className="container-app">
          <p className="label-sm mb-3 text-ink-400">El proceso</p>
          <ol className="space-y-6">
            {[
              ['Sube tu PDF', 'Arrastra el extracto de tu cartera o selecciónalo desde tu móvil u ordenador. Leemos las posiciones automáticamente.'],
              ['Responde unas preguntas breves', 'Objetivo, horizonte, riesgo y liquidez — solo lo necesario, nada de formularios interminables.'],
              ['Recibe tu informe', 'Composición, diversificación, riesgo, rentabilidad y recomendaciones justificadas una a una.'],
            ].map(([title, body], i) => (
              <li key={title} className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-950 text-xs font-medium text-white">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink-950">{title}</p>
                  <p className="text-sm text-ink-600">{body}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-12">
            <Link href="/analizar" className="btn-primary">
              Analiza mi cartera
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-ink-100 py-10">
        <div className="container-app flex flex-col gap-2 text-xs text-ink-400 sm:flex-row sm:justify-between">
          <span>© {new Date().getFullYear()} CarteroAI. Información y educación financiera, no asesoramiento personalizado.</span>
          <Link href="/legal" className="hover:text-ink-700">
            Aviso legal y privacidad
          </Link>
        </div>
      </footer>
    </main>
  );
}
