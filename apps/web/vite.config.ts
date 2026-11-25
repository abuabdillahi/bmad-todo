import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // The dev profile's web tier (AD-4): /api/* is forwarded to the API with the
    // path unchanged (no rewrite), the same prefix nginx's `location /api/` takes.
    proxy: { '/api/': 'http://api:3000' },
  },
  build: {
    // Inline nothing: the CSP (default-src 'self') blocks data: URIs (AD-19).
    assetsInlineLimit: 0,
  },
});
