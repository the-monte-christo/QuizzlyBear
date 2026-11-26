// Schreibt /schema/quiz.schema.json aus den Fragetyp-Modulen und legt das Beispiel-Quiz
// (examples/demo) als JSON und als hochladbares ZIP daneben.
//   npm run build:schema
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { zipSync } from 'fflate';
import { buildQuizSchema } from '../src/types/schema';

const DEMO = 'examples/demo';

mkdirSync('schema', { recursive: true });
writeFileSync('schema/quiz.schema.json', JSON.stringify(buildQuizSchema(), null, 2) + '\n');

const quiz = readFileSync(join(DEMO, 'quiz.json'), 'utf8').replace('"../../schema/quiz.schema.json"', '"./quiz.schema.json"');
writeFileSync('schema/beispiel-quiz.json', quiz);

// festes Datum, damit das ZIP bei unverändertem Inhalt identisch bleibt
const files: Record<string, Uint8Array> = { 'quiz.json': new TextEncoder().encode(quiz) };
for (const name of readdirSync(join(DEMO, 'img')).sort()) files[`img/${name}`] = readFileSync(join(DEMO, 'img', name));
writeFileSync('schema/beispiel-quiz.zip', zipSync(files, { mtime: new Date('2026-01-01T12:00:00') }));

console.log('schema/quiz.schema.json, beispiel-quiz.json und beispiel-quiz.zip geschrieben.');
