import fs from 'node:fs';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // The API port comes from the shared root .env file (not process.env, where a
  // tool might have set PORT for Vite itself). VITE_API_PROXY_TARGET overrides it.
  const rootDir = path.resolve(import.meta.dirname, '..');
  const envFile = path.join(rootDir, '.env');
  const filePort = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8').match(/^\s*PORT\s*=\s*(\d+)/m)?.[1] : null;
  const { VITE_API_PROXY_TARGET } = loadEnv(mode, rootDir, 'VITE_');
  const apiTarget = VITE_API_PROXY_TARGET || `http://127.0.0.1:${filePort || 5000}`;

  // Same-origin in development → the httpOnly auth cookie just works.
  const proxy = {
    '/api': { target: apiTarget, changeOrigin: true },
    '/uploads': { target: apiTarget, changeOrigin: true },
  };

  return {
    plugins: [react(), tailwindcss()],
    envDir: rootDir,
    build: { chunkSizeWarningLimit: 600 },
    server: { port: 5173, proxy },
    preview: { port: 4173, proxy },
  };
});
