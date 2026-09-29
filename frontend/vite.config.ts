import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** Where the dev server forwards `/api` requests. Matches `PORT` in the backend. */
const API_TARGET = 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    /**
     * Proxying `/api` in development keeps the browser on a single origin, so
     * the console never needs a CORS exemption and the `x-user-id` header is
     * added in one place (the API client) regardless of environment.
     */
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
    },
  },
  /**
   * Belt and braces against a duplicated React in the dependency graph: two
   * copies break hooks at runtime with a confusing "invalid hook call" error.
   */
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
