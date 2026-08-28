export const MAX_UPLOAD_BYTES = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB ?? 15) * 1024 * 1024;

export interface UploadValidation {
  valid: boolean;
  error?: string;
}

export function validatePdfUpload(file: { size: number; type: string; name: string }): UploadValidation {
  if (file.size === 0) return { valid: false, error: 'El archivo está vacío.' };
  if (file.size > MAX_UPLOAD_BYTES) {
    return { valid: false, error: `El archivo supera el tamaño máximo permitido (${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB).` };
  }
  const looksLikePdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!looksLikePdf) return { valid: false, error: 'Solo se admiten archivos PDF.' };
  return { valid: true };
}

/** Comprueba la cabecera real del archivo (%PDF-) para no fiarse solo de la extensión/MIME declarados por el navegador. */
export function hasPdfMagicBytes(buffer: Buffer): boolean {
  return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
}
