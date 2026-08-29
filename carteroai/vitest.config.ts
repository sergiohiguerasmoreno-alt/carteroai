import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      // Debe ir antes que '@' (Vitest resuelve alias en orden): evita que
      // 'server-only' rompa al importarse en los tests. Ver
      // lib/testing/server-only-stub.ts para el motivo.
      'server-only': path.resolve(__dirname, './lib/testing/server-only-stub.ts'),
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'node',
  },
});
