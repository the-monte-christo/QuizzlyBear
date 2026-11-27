import { createServer } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { createApp } from './app';
import { hashPassword } from './auth';
import { config } from './config';
import { openDb } from './db';
import { GameManager } from './game/manager';
import { nodeStatus } from './runtime';
import { attachSockets, makeGameIO } from './sockets';

// Laufzeit prüfen, bevor irgendetwas am Netz hängt: Auf einem Server startet die App nicht
// mit einer Node-Version, die bekannte Lücken hat. Lokal bleibt es bei einer Warnung.
const node = nodeStatus();
if (!node.ok) {
  if (config.prod) {
    console.error(`FEHLER: ${node.message} Der Server startet so nicht.`);
    process.exit(1);
  }
  console.warn(`WARNUNG: ${node.message} Für die lokale Entwicklung geht es weiter – nicht so ins Netz stellen.`);
}

const here = dirname(fileURLToPath(import.meta.url));
// Gebaut liegt diese Datei in dist/server, in der Entwicklung in src/server – beides zwei Ebenen unter der Wurzel
const root = resolve(here, '../..');
const webDir = join(root, 'dist/web');
const schemaDir = join(root, 'schema');

const db = openDb(config.dataDir);
db.purgeSessions();
// abgelaufene Sitzungen stündlich entfernen
setInterval(() => db.purgeSessions(), 60 * 60 * 1000).unref();

if (db.userCount() === 0) {
  if (config.adminUser && config.adminPassword) {
    if (config.adminPassword.length < 8) {
      console.error('FEHLER: ADMIN_PASSWORD braucht mindestens 8 Zeichen. Es wurde kein Quizmaster angelegt.');
    } else {
      db.addUser(config.adminUser, hashPassword(config.adminPassword), true);
      console.log(`Quizmaster „${config.adminUser}“ angelegt.`);
    }
  } else {
    console.log('Noch kein Quizmaster vorhanden. Anlegen mit: npm run user:add -- <name> <passwort> --admin');
  }
}

// Express muss vor Socket.io am Server hängen, sonst beantworten beide /socket.io
let app: ReturnType<typeof createApp> | undefined;
const httpServer = createServer((req, res) => app?.(req, res));
const io = new Server(httpServer, {
  serveClient: false,
  // Mobilnetz: lieber etwas großzügiger, bevor eine Verbindung als tot gilt
  pingInterval: 10_000,
  pingTimeout: 15_000,
  maxHttpBufferSize: 64 * 1024,
  // Keine Kompression auf Socket-Ebene: Die Nachrichten sind winzig, und es gibt keinen
  // Decoder, den fremde Daten erreichen könnten. Statische Dateien komprimiert der Reverse Proxy.
  perMessageDeflate: false,
  httpCompression: false,
});
const games = new GameManager(makeGameIO(io));
attachSockets(io, games);
app = createApp({ db, games, webDir, schemaDir });

httpServer.listen(config.port, '0.0.0.0', () => {
  console.log(`QuizzlyBear läuft auf http://localhost:${config.port} (${config.prod ? 'Produktion' : 'Entwicklung'}, ${node.message})`);
});

function shutdown() {
  io.close();
  httpServer.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
