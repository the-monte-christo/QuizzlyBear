// Bündelt den Server nach dist/server/index.js. Eigener Code wird zusammengefasst,
// Pakete aus node_modules bleiben extern (sharp und better-sqlite3 sind nativ).
import { build } from 'esbuild';

await build({
  entryPoints: ['src/server/index.ts'],
  outfile: 'dist/server/index.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  packages: 'external',
  sourcemap: true,
  logLevel: 'info',
});
