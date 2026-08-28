// pdfjs-dist no publica tipos para la ruta interna de su módulo "worker"
// (solo se usa aquí para registrarlo manualmente en globalThis.pdfjsWorker —
// ver lib/parsing/pdf-text.ts). Lo declaramos como módulo ambiguo para que
// TypeScript permita el import estático sin marcarlo como error.
declare module 'pdfjs-dist/legacy/build/pdf.worker.mjs' {
  export const WorkerMessageHandler: unknown;
}
