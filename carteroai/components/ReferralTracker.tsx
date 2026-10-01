'use client';

import { useEffect } from 'react';

// Se monta en la portada (app/page.tsx). Cuando alguien abre un enlace de
// referido (?ref=<id>, compartido desde components/flow/PaywallStep.tsx),
// avisa al servidor de que ese enlace se ha abierto de verdad — es lo que
// desbloquea el informe de la persona que lo compartió (ver
// app/api/orders/[id]/referral-hit y lib/payments/store.ts). No renderiza
// nada visible: la portada se ve exactamente igual con o sin `?ref=`.
export function ReferralTracker() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (!ref) return;

    // Quita `?ref=` de la URL visible enseguida (antes de decidir si se
    // notifica o no), para que no quede pegado si la persona comparte esta
    // misma página o recarga.
    window.history.replaceState(null, '', window.location.pathname);

    // Si quien abre el enlace es el propio dueño del informe en el mismo
    // navegador (p.ej. comprobando que el enlace funciona), no cuenta como
    // una apertura real por parte de otra persona — ver el comentario en
    // PaywallStep.tsx sobre esta comprobación.
    let ownOrderId: string | null = null;
    try {
      ownOrderId = window.localStorage.getItem('carteroai-own-order');
    } catch {
      // Sin acceso a localStorage no podemos comprobarlo: seguimos
      // adelante y se cuenta igualmente, mejor eso que no desbloquear
      // nunca un enlace legítimo.
    }
    if (ownOrderId === ref) return;

    // Evita notificar dos veces el mismo `ref` en la misma pestaña (p.ej.
    // si este efecto se volviera a ejecutar por algún motivo).
    const dedupeKey = `carteroai-ref-hit-${ref}`;
    try {
      if (window.sessionStorage.getItem(dedupeKey)) return;
      window.sessionStorage.setItem(dedupeKey, '1');
    } catch {
      // Sin sessionStorage, en el peor caso se notifica más de una vez —
      // inofensivo, el servidor solo necesita una apertura para desbloquear.
    }

    fetch(`/api/orders/${ref}/referral-hit`, { method: 'POST' }).catch(() => undefined);
  }, []);

  return null;
}
