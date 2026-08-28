/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: {
    ignoreDuringBuilds: false,
  },
  // pdfjs-dist se ejecuta solo en servidor y gestiona su propio worker "fake"
  // en Node; si Next lo empaqueta con webpack, la ruta al worker se rompe.
  // Se mantiene como dependencia externa en tiempo de ejecución (require()
  // directo desde node_modules) para evitar ese problema.
  //
  // Además, en despliegues serverless (Vercel) el trazador de archivos solo
  // incluye en la función lo que puede detectar estáticamente; el import
  // dinámico interno de pdfjs-dist para su worker no es detectable (ver
  // lib/parsing/pdf-text.ts, donde ya lo evitamos con un import estático),
  // así que forzamos también aquí, de forma explícita, que el archivo del
  // worker se incluya en el paquete de la ruta que procesa PDFs — doble
  // seguro para que un cambio futuro en pdfjs-dist no vuelva a romperlo
  // silenciosamente solo en producción.
  experimental: {
    serverComponentsExternalPackages: ['pdfjs-dist'],
    outputFileTracingIncludes: {
      '/api/upload': ['./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'],
    },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
