import Link from 'next/link';
import { DISCLAIMER_TEXT } from '@/lib/config/legal-flags';

export const metadata = { title: 'Aviso legal y privacidad — CarteroAI' };

export default function LegalPage() {
  return (
    <main className="container-app py-12">
      <Link href="/" className="btn-ghost -ml-4 mb-8">
        ← Volver
      </Link>
      <h1 className="mb-8 font-serif text-3xl text-ink-950">Aviso legal y privacidad</h1>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-signal-teal">Qué es CarteroAI</h2>
        <p className="text-sm leading-relaxed text-ink-700">{DISCLAIMER_TEXT}</p>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-signal-teal">Información, educación y asesoramiento</h2>
        <p className="mb-3 text-sm leading-relaxed text-ink-700">
          Es importante distinguir tres cosas distintas: la <strong>información</strong> (datos de mercado que
          consultamos y te mostramos), la <strong>educación financiera</strong> (explicaciones para que entiendas qué
          significan esos datos) y el <strong>análisis automatizado</strong> (cálculos y un motor de reglas que
          identifica posibles problemas en tu cartera). Nada de esto equivale a <strong>asesoramiento financiero
          personalizado</strong> en el sentido regulado por la normativa MiFID II, que en España requiere estar
          habilitado ante la CNMV.
        </p>
        <p className="text-sm leading-relaxed text-ink-700">
          CarteroAI está diseñada para poder adaptarse a distintos marcos legales: algunas funcionalidades pueden
          activarse o desactivarse según la jurisdicción y el régimen bajo el que se opere el producto. Antes de
          comercializar cualquier forma de asesoramiento personalizado, el marco legal aplicable debe revisarse y
          adaptarse formalmente.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-signal-teal">Privacidad y seguridad de tus datos</h2>
        <ul className="list-inside list-disc space-y-2 text-sm leading-relaxed text-ink-700">
          <li>Tu PDF se procesa en memoria durante la petición y nunca se escribe en disco ni se almacena.</li>
          <li>No conservamos tu cartera, tus respuestas ni tu informe en ningún servidor: viven únicamente en tu navegador durante la sesión.</li>
          <li>No registramos el contenido financiero de tu cartera en logs; solo mensajes de error técnicos genéricos.</li>
          <li>Las claves de API de proveedores de datos y de IA se usan exclusivamente en el servidor, nunca en el navegador.</li>
          <li>Un usuario nunca puede ver los datos de otro: no existe almacenamiento compartido entre sesiones.</li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-signal-teal">Email antes del informe</h2>
        <p className="mb-3 text-sm leading-relaxed text-ink-700">
          Antes de mostrarte el informe te pedimos tu email, con tu consentimiento explícito mediante una casilla que
          debes marcar de forma voluntaria. Lo usamos para enviarte comunicaciones sobre CarteroAI y sobre análisis
          de inversión. A diferencia del resto de datos de tu sesión (cartera, respuestas, informe), que nunca se
          almacenan, el email sí se guarda de forma persistente junto con la fecha, tu objetivo de inversión y tu
          horizonte temporal aproximado — nunca junto con el detalle de tu cartera ni con el resto de tus respuestas
          al cuestionario.
        </p>
        <p className="text-sm leading-relaxed text-ink-700">
          Puedes darte de baja de estas comunicaciones en cualquier momento respondiendo a cualquier email que te
          enviemos o escribiéndonos directamente. Si prefieres no facilitar tu email, no podrás acceder al informe
          generado en esta versión de la aplicación.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-signal-teal">Rentabilidad pasada</h2>
        <p className="text-sm leading-relaxed text-ink-700">
          Cualquier cifra de rentabilidad histórica que se muestre se basa en datos pasados y no garantiza ni permite
          predecir la rentabilidad futura.
        </p>
      </section>
    </main>
  );
}
