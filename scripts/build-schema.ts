// Schreibt /schema/quiz.schema.json aus den Fragetyp-Modulen.
//   npm run build:schema
import { mkdirSync, writeFileSync } from 'node:fs';
import { buildQuizSchema } from '../src/types/schema';

mkdirSync('schema', { recursive: true });
writeFileSync('schema/quiz.schema.json', JSON.stringify(buildQuizSchema(), null, 2) + '\n');
console.log('schema/quiz.schema.json geschrieben.');
