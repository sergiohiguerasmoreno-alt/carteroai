import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CarteroAI — Análisis inteligente de tu cartera de inversión',
  description:
    'Sube el PDF de tu cartera y recibe un análisis profundo, personalizado y honesto: solo te recomendamos cambios cuando existe una razón sólida para hacerlos.',
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0b0f14',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
