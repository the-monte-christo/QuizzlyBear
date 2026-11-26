// Entwicklungs-Startpaket: legt den Quizmaster „demo“ (Passwort „demodemo“) und ein Demo-Quiz an.
// Nur für die lokale Entwicklung gedacht.
import { hashPassword } from '../src/server/auth';
import { config } from '../src/server/config';
import { openDb } from '../src/server/db';
import { DEFAULT_SETTINGS, type Quiz } from '../src/shared/quiz';

const db = openDb(config.dataDir);
let user = db.userByName('demo');
if (!user) {
  db.addUser('demo', hashPassword('demodemo'), true);
  user = db.userByName('demo')!;
  console.log('Quizmaster „demo“ mit Passwort „demodemo“ angelegt.');
}

const mc = (id: string, text: string, options: string[], correct: number, time = 20) => ({
  id,
  type: 'mcsa' as const,
  text,
  time,
  points: 1000,
  answer: { options, correct },
});

const quiz: Quiz = {
  title: 'Bärenstarkes Aufwärmquiz',
  description: 'Fünf schnelle Fragen zum Testen.',
  settings: DEFAULT_SETTINGS,
  questions: [
    mc('q1', 'Was fressen Grizzlybären im Spätsommer besonders gern?', ['Beeren', 'Tannenzapfen', 'Seetang', 'Pilze'], 0),
    mc('q2', 'Wie viele Beine hat eine Biene?', ['Vier', 'Sechs', 'Acht', 'Zehn'], 1, 15),
    mc('q3', 'Welche Farbe entsteht, wenn man Blau und Gelb mischt?', ['Orange', 'Violett', 'Grün', 'Braun'], 2, 10),
    {
      ...mc('q4', 'Welcher Fisch wird zu Rollmops verarbeitet?', ['Lachs', 'Forelle', 'Makrele', 'Hering'], 3),
      explanation: 'Herry lässt grüßen: Rollmops ist eingelegter Hering.',
    },
    mc(
      'q5',
      'Wie nennt man den Zucker, der Honig seine Süße gibt, hauptsächlich?',
      ['Fruchtzucker und Traubenzucker', 'Milchzucker', 'Rohrzucker', 'Malzzucker'],
      0,
      25,
    ),
  ],
};

if (!db.quizzes().some((q) => q.title === quiz.title)) {
  db.addQuiz(user.id, quiz);
  console.log(`Demo-Quiz „${quiz.title}“ angelegt.`);
}
db.close();
