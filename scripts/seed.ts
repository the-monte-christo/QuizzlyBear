// Entwicklungs-Startpaket: legt den Quizmaster „demo“ (Passwort „demodemo“) an und importiert
// das Demo-Quiz mit allen Fragetypen über den normalen Upload-Weg. Nur für die lokale Entwicklung.
import { readFileSync } from 'node:fs';
import { hashPassword } from '../src/server/auth';
import { config } from '../src/server/config';
import { openDb } from '../src/server/db';
import { importQuiz, ImportFailure } from '../src/server/quiz/import';

const db = openDb(config.dataDir);
let user = db.userByName('demo');
if (!user) {
  db.addUser('demo', hashPassword('demodemo'), true);
  user = db.userByName('demo')!;
  console.log('Quizmaster „demo“ mit Passwort „demodemo“ angelegt.');
}

try {
  const { quiz } = await importQuiz(readFileSync('schema/beispiel-quiz.zip'), { dataDir: config.dataDir });
  const existing = db.quizzes().find((q) => q.title === quiz.title && q.owner_id === user.id);
  if (existing) db.updateQuiz(existing.id, quiz);
  else db.addQuiz(user.id, quiz);
  console.log(`Demo-Quiz „${quiz.title}“ ${existing ? 'aktualisiert' : 'angelegt'} (${quiz.questions.length} Fragen).`);
} catch (err) {
  if (err instanceof ImportFailure) console.error(err.message, err.errors);
  else throw err;
  process.exitCode = 1;
}
db.close();
