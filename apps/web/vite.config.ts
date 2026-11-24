import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    // Inline nothing: the CSP (default-src 'self') blocks data: URIs (AD-19).
    assetsInlineLimit: 0,
  },
});
