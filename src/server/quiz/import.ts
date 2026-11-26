// Quiz-Import: ZIP (quiz.json + Bilder) oder reine quiz.json mit Bild-URLs.
// Ergebnis ist das normalisierte Quiz, wie es gespeichert und gespielt wird.
import { unzipSync } from 'fflate';
import { mergeSettings, type ImageRef, type Question, type Quiz } from '../../shared/quiz';
import { existingImage, fetchImage, storeImage } from './images';
import { validateQuiz, type ImportError } from './validate';

export class ImportFailure extends Error {
  constructor(
    message: string,
    readonly errors: ImportError[] = [],
  ) {
    super(message);
  }
}

export interface ImportOptions {
  dataDir: string;
  /** Bild-URLs aus dem internen Netz zulassen (nur Tests und lokale Entwicklung). */
  allowPrivateUrls?: boolean;
}

export interface ImportResult {
  quiz: Quiz;
  warnings: string[];
}

const MAX_UNZIPPED = 150 * 1024 * 1024;
const MAX_ENTRIES = 600;
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif|tiff?|heic|heif)$/i;
const isUrl = (s: string) => /^https?:\/\//i.test(s);
const norm = (p: string) => p.replace(/\\/g, '/').replace(/^\.?\//, '').replace(/\/+/g, '/');

function readZip(body: Buffer): { json: string; files: Map<string, Uint8Array> } {
  let total = 0;
  let count = 0;
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(new Uint8Array(body), {
      filter(file) {
        if (file.name.endsWith('/') || file.name.includes('__MACOSX/')) return false;
        if (!/(^|\/)quiz\.json$/i.test(file.name) && !IMAGE_EXT.test(file.name)) return false;
        total += file.originalSize;
        if (++count > MAX_ENTRIES || total > MAX_UNZIPPED) {
          throw new ImportFailure('Das ZIP ist zu groß (höchstens 600 Dateien und 150 MB entpackt).');
        }
        return true;
      },
    });
  } catch (err) {
    if (err instanceof ImportFailure) throw err;
    throw new ImportFailure('Die Datei ist kein lesbares ZIP-Archiv.');
  }

  // quiz.json darf im Wurzelverzeichnis oder in einem Ordner liegen (wenn ein Ordner gezippt wurde)
  const jsonPaths = Object.keys(entries)
    .filter((n) => /(^|\/)quiz\.json$/i.test(n))
    .sort((a, b) => a.split('/').length - b.split('/').length);
  if (jsonPaths.length === 0) throw new ImportFailure('Im ZIP fehlt die Datei quiz.json.');
  const jsonPath = jsonPaths[0];
  const base = jsonPath.slice(0, jsonPath.length - 'quiz.json'.length);

  const files = new Map<string, Uint8Array>();
  for (const [name, data] of Object.entries(entries)) {
    if (name !== jsonPath && name.startsWith(base)) files.set(norm(name.slice(base.length)), data);
  }
  return { json: Buffer.from(entries[jsonPath]).toString('utf8'), files };
}

export async function importQuiz(body: Buffer, opts: ImportOptions): Promise<ImportResult> {
  if (body.length === 0) throw new ImportFailure('Die Datei ist leer.');
  const isZip = body.length > 3 && body[0] === 0x50 && body[1] === 0x4b && body[2] === 0x03 && body[3] === 0x04;
  const { json, files } = isZip ? readZip(body) : { json: body.toString('utf8'), files: null };

  let raw: any;
  try {
    raw = JSON.parse(json.replace(/^﻿/, ''));
  } catch (err) {
    throw new ImportFailure('quiz.json ist kein gültiges JSON.', [{ path: 'quiz.json', message: (err as Error).message }]);
  }

  const errors = validateQuiz(raw);
  if (errors.length) throw new ImportFailure(`Das Quiz hat ${errors.length === 1 ? 'einen Fehler' : `${errors.length} Fehler`}.`, errors);

  // ---- Bilder auflösen: jedes Bild nur einmal verarbeiten
  const warnings: string[] = [];
  const cache = new Map<string, Promise<ImageRef>>();
  const used = new Set<string>();
  const lower = files ? new Map([...files.keys()].map((k) => [k.toLowerCase(), k])) : null;

  const resolve = (ref: string): Promise<ImageRef> => {
    let job = cache.get(ref);
    if (job) return job;
    job = (async () => {
      if (isUrl(ref)) {
        const known = await existingImage(ref, opts.dataDir);
        if (known) return known;
        let data: Buffer;
        try {
          data = await fetchImage(ref, opts.allowPrivateUrls);
        } catch (err) {
          throw new Error(`Das Bild konnte nicht geladen werden: ${(err as Error).message}.`);
        }
        return storeImage(data, opts.dataDir).catch((err) => {
          throw new Error(`Die Adresse liefert kein verwendbares Bild (${(err as Error).message}).`);
        });
      }
      if (!files || !lower) {
        throw new Error('Bildpfade funktionieren nur im ZIP. In einer reinen quiz.json bitte eine Bild-URL (https://…) angeben.');
      }
      const key = lower.get(norm(ref).toLowerCase());
      if (!key) throw new Error(`Das Bild „${ref}“ fehlt im ZIP.`);
      used.add(key);
      return storeImage(Buffer.from(files.get(key)!), opts.dataDir).catch((err) => {
        throw new Error(`„${ref}“ ist kein verwendbares Bild (${(err as Error).message}).`);
      });
    })();
    cache.set(ref, job);
    return job;
  };

  const imageErrors: ImportError[] = [];
  const questions: Question[] = [];
  // Bilder nacheinander verarbeiten: Das begrenzt den Speicherbedarf (Container mit festem Limit)
  for (const [i, q] of (raw.questions as any[]).entries()) {
    let image: ImageRef | undefined;
    if (q.image) {
      try {
        image = await resolve(q.image);
      } catch (err) {
        imageErrors.push({ path: `Frage ${i + 1} (${q.type}) · image`, message: (err as Error).message });
      }
    }
    questions.push({
      id: q.id ?? `q${i + 1}`,
      type: q.type,
      text: q.text.trim(),
      image,
      time: q.time ?? 20,
      points: q.points ?? 1000,
      explanation: q.explanation?.trim() || undefined,
      answer: q.answer,
    });
  }
  if (imageErrors.length) {
    throw new ImportFailure(
      imageErrors.length === 1 ? 'Ein Bild konnte nicht verarbeitet werden.' : `${imageErrors.length} Bilder konnten nicht verarbeitet werden.`,
      imageErrors,
    );
  }

  if (files) {
    const unused = [...files.keys()].filter((k) => !used.has(k));
    if (unused.length) warnings.push(`Nicht verwendete Bilder im ZIP: ${unused.slice(0, 5).join(', ')}${unused.length > 5 ? ' …' : ''}.`);
  }

  return {
    quiz: {
      title: raw.title.trim(),
      description: (raw.description ?? '').trim(),
      settings: mergeSettings(raw.settings),
      questions,
    },
    warnings,
  };
}

/** Wandelt ein gespeichertes Quiz zurück ins Upload-Format (Bilder als absolute URLs). */
export function exportQuiz(quiz: Quiz, origin: string): unknown {
  return {
    $schema: `${origin}/schema/quiz.schema.json`,
    title: quiz.title,
    description: quiz.description || undefined,
    settings: quiz.settings,
    questions: quiz.questions.map((q) => ({
      id: q.id,
      type: q.type,
      text: q.text,
      image: q.image ? `${origin}${q.image.src}` : undefined,
      time: q.time,
      points: q.points,
      explanation: q.explanation,
      answer: q.answer,
    })),
  };
}
