import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'node:path';

const api = `http://127.0.0.1:${process.env.PORT ?? 3000}`;

// Drei getrennte Einstiege, damit das Handy nur den Spieler-Code lädt:
//   /        Spieler (Handy)
//   /host/   Host-Screen (Beamer / 4K-TV)
//   /admin/  Quizmaster
export default defineConfig({
  root: 'src/web',
  publicDir: 'public',
  plugins: [svelte()],
  build: {
    outDir: '../../dist/web',
    emptyOutDir: true,
    target: 'es2020',
    rollupOptions: {
      input: {
        player: resolve('src/web/index.html'),
        host: resolve('src/web/host/index.html'),
        admin: resolve('src/web/admin/index.html'),
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': api,
      '/img': api,
      '/schema': api,
      '/socket.io': { target: api, ws: true },
    },
  },
});
