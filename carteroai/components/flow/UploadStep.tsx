'use client';

import { useCallback, useRef, useState } from 'react';

interface Props {
  onFileSelected: (file: File) => void;
  maxSizeMb: number;
  errorMessage?: string | null;
}

export function UploadStep({ onFileSelected, maxSizeMb, errorMessage }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (file) onFileSelected(file);
    },
    [onFileSelected],
  );

  return (
    <div className="container-app flex min-h-[80vh] flex-col justify-center py-12">
      <p className="label-sm mb-2 text-signal-teal">Paso 1 de 4</p>
      <h1 className="mb-3 font-serif text-3xl text-ink-950 sm:text-4xl">Sube el PDF de tu cartera</h1>
      <p className="mb-8 max-w-lg text-sm leading-relaxed text-ink-600">
        Puede ser el extracto de posiciones de tu bróker, banco o gestora. Léelo bien: procesamos el archivo en
        memoria y no lo guardamos en ningún sitio.
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
        className={
          'flex cursor-pointer flex-col items-center justify-center rounded-xl2 border-2 border-dashed px-6 py-14 text-center transition ' +
          (isDragging ? 'border-signal-teal bg-signal-teal/5' : 'border-ink-200 bg-white hover:border-ink-400')
        }
      >
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-ink-950 text-white">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 16V4M12 4L7 9M12 4l5 5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="mb-1 text-sm font-medium text-ink-950">
          Arrastra tu PDF aquí <span className="hidden sm:inline">o haz clic para seleccionarlo</span>
          <span className="sm:hidden">o toca para seleccionarlo</span>
        </p>
        <p className="text-xs text-ink-400">Formato admitido: PDF · Tamaño máximo: {maxSizeMb} MB</p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {errorMessage && (
        <p className="mt-4 rounded-lg bg-signal-rose/10 px-4 py-3 text-sm text-signal-rose">{errorMessage}</p>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="card p-4">
          <p className="mb-1 text-xs font-semibold text-ink-950">Privacidad</p>
          <p className="text-xs leading-relaxed text-ink-500">
            Tu PDF se procesa en memoria y se descarta al terminar. No se almacena ni se comparte con terceros.
          </p>
        </div>
        <div className="card p-4">
          <p className="mb-1 text-xs font-semibold text-ink-950">Antes de empezar</p>
          <p className="text-xs leading-relaxed text-ink-500">
            Leemos automáticamente las posiciones de tu PDF. Si algo no se identifica bien, te lo indicaremos en el
            propio informe en vez de pedirte que lo revises antes.
          </p>
        </div>
      </div>
    </div>
  );
}
