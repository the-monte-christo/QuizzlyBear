import { defineConfig, type Connect, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'node:path';

const api = `http://127.0.0.1:${process.env.PORT ?? 3000}`;

// /admin und /host ohne Schrägstrich am Ende: Der Entwicklungs-Server von Vite würde sonst
// stillschweigend die Spieler-Seite ausliefern. (Im gebauten Server leitet Express selbst um.)
const addSlash: Connect.NextHandleFunction = (req, res, next) => {
  const [path, query] = (req.url ?? '').split('?');
  if (path !== '/admin' && path !== '/host') return next();
  res.statusCode = 302;
  res.setHeader('Location', `${path}/${query ? `?${query}` : ''}`);
  res.end();
};
const trailingSlash = (): Plugin => ({
  name: 'quizzlybear-trailing-slash',
  configureServer: (server) => void server.middlewares.use(addSlash),
  configurePreviewServer: (server) => void server.middlewares.use(addSlash),
});

// Drei getrennte Einstiege, damit das Handy nur den Spieler-Code lädt:
//   /        Spieler (Handy)
//   /host/   Host-Screen (Beamer / 4K-TV)
//   /admin/  Quizmaster
export default defineConfig({
  root: 'src/web',
  publicDir: 'public',
  plugins: [trailingSlash(), svelte({ configFile: resolve('svelte.config.js') })],
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
      // xfwd: Der Server prüft die Herkunft schreibender Anfragen gegen den ursprünglichen Host
      '/api': { target: api, xfwd: true },
      '/img': api,
      '/schema': api,
      '/socket.io': { target: api, ws: true },
    },
  },
});
