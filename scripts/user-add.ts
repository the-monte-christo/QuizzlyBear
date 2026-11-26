// Legt einen Quizmaster an oder setzt sein Passwort neu.
//   npm run user:add -- <name> <passwort> [--admin]
import { hashPassword } from '../src/server/auth';
import { config } from '../src/server/config';
import { openDb } from '../src/server/db';

const args = process.argv.slice(2);
const admin = args.includes('--admin');
const [name, password] = args.filter((a) => !a.startsWith('--'));

if (!name || !password || password.length < 8) {
  console.error('Aufruf: npm run user:add -- <name> <passwort mit mind. 8 Zeichen> [--admin]');
  process.exit(1);
}

const db = openDb(config.dataDir);
const existing = db.userByName(name);
if (existing) {
  db.setPassword(existing.id, hashPassword(password));
  db.deleteUserSessions(existing.id);
  console.log(`Passwort für „${existing.name}“ neu gesetzt.`);
} else {
  db.addUser(name, hashPassword(password), admin);
  console.log(`Quizmaster „${name}“ angelegt${admin ? ' (Admin)' : ''}.`);
}
db.close();
