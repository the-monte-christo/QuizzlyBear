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

const MAX_UNZIPPED = 100 * 1024 * 1024;
/** So viele Bild-URLs werden gleichzeitig geladen. Umgerechnet wird immer nur ein Bild auf einmal. */
const FETCH_PARALLEL = 4;
/** Gesamtzeit für das Laden aller Bild-URLs – bleibt unter dem Timeout des Reverse Proxys. */
const REMOTE_BUDGET_MS = 90_000;
const MAX_ENTRIES = 600;
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif)$/i;
const isUrl = (s: string) => /^https?:\/\//i.test(s);
const norm = (p: string) => p.replace(/\\/g, '/').replace(/^\.?\//, '').replace(/\/+/g, '/');

function readZip(body: Buffer): { json: string; files: Map<string, Uint8Array> } {
  let total = 0;
  let count = 0;
  let entries: Record<string, Uint8Array>;
  try {
    // Sicht auf den Puffer statt Kopie: Der Upload liegt sonst doppelt im Speicher
    entries = unzipSync(new Uint8Array(body.buffer, body.byteOffset, body.byteLength), {
      filter(file) {
        if (file.name.endsWith('/') || file.name.includes('__MACOSX/')) return false;
        if (!/(^|\/)quiz\.json$/i.test(file.name) && !IMAGE_EXT.test(file.name)) return false;
        total += file.originalSize;
        if (++count > MAX_ENTRIES || total > MAX_UNZIPPED) {
          throw new ImportFailure('Das ZIP ist zu groß (höchstens 600 Dateien und 100 MB entpackt).');
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
    raw = JSON.parse(json.replace(/^\uFEFF/, ''));
  } catch (err) {
    throw new ImportFailure('quiz.json ist kein gültiges JSON.', [{ path: 'quiz.json', message: (err as Error).message }]);
  }

  const errors = validateQuiz(raw);
  if (errors.length) throw new ImportFailure(`Das Quiz hat ${errors.length === 1 ? 'einen Fehler' : `${errors.length} Fehler`}.`, errors);

  // ---- Bilder auflösen: jedes Bild nur einmal verarbeiten
  const warnings: string[] = [];
  const zipNames = files ? [...files.keys()] : [];
  const used = new Set<string>();
  const lower = files ? new Map(zipNames.map((k) => [k.toLowerCase(), k])) : null;

  // Umrechnen (sharp) strikt nacheinander: Jedes Bild liegt dabei unkomprimiert im Speicher,
  // und der Container hat ein festes Limit.
  let encoding: Promise<unknown> = Promise.resolve();
  const store = (data: Buffer): Promise<ImageRef> => {
    const job = encoding.then(() => storeImage(data, opts.dataDir));
    encoding = job.catch(() => {});
    return job;
  };

  const remoteDeadline = Date.now() + REMOTE_BUDGET_MS;
  const byZipEntry = new Map<string, Promise<ImageRef>>();
  const byRef = new Map<string, Promise<ImageRef>>();

  const resolve = (ref: string): Promise<ImageRef> => {
    let job = byRef.get(ref);
    if (job) return job;
    if (isUrl(ref)) {
      job = (async () => {
        const known = await existingImage(ref, opts.dataDir);
        if (known) return known;
        const left = remoteDeadline - Date.now();
        if (left <= 0) throw new Error('Das Laden der Bilder hat insgesamt zu lange gedauert (mehr als 90 Sekunden). Weniger oder schnellere Bild-URLs verwenden – oder die Bilder ins ZIP legen.');
        let data: Buffer;
        try {
          data = await fetchImage(ref, opts.allowPrivateUrls, Math.min(15_000, left));
        } catch (err) {
          throw new Error(`Das Bild konnte nicht geladen werden: ${(err as Error).message}.`);
        }
        return store(data).catch((err) => {
          throw new Error(`Die Adresse liefert kein verwendbares Bild (${(err as Error).message}).`);
        });
      })();
    } else if (!files || !lower) {
      job = Promise.reject(new Error('Bildpfade funktionieren nur im ZIP. In einer reinen quiz.json bitte eine Bild-URL (https://…) angeben.'));
    } else {
      const key = lower.get(norm(ref).toLowerCase());
      if (!IMAGE_EXT.test(ref)) {
        job = Promise.reject(new Error(`„${ref}“ hat einen Dateityp, der nicht unterstützt wird. Erlaubt sind JPEG, PNG, WebP, GIF und AVIF.`));
      } else if (!key) {
        job = Promise.reject(new Error(`Das Bild „${ref}“ fehlt im ZIP.`));
      } else {
        used.add(key);
        // verschiedene Schreibweisen desselben Pfads teilen sich eine Verarbeitung
        job = byZipEntry.get(key);
        if (!job) {
          const entry = files.get(key)!;
          job = store(Buffer.from(entry.buffer, entry.byteOffset, entry.byteLength))
            .catch((err) => {
              throw new Error(`„${ref}“ ist kein verwendbares Bild (${(err as Error).message}).`);
            })
            .finally(() => files.delete(key)); // entpackte Daten sofort freigeben
          byZipEntry.set(key, job);
        }
      }
    }
    job.catch(() => {}); // Fehler werden unten je Frage gemeldet
    byRef.set(ref, job);
    return job;
  };

  // Bild-URLs mit begrenzter Parallelität laden, damit viele langsame Adressen nicht in den
  // Proxy-Timeout laufen; die Reihenfolge der Fragen bleibt davon unberührt.
  const refs = [...new Set((raw.questions as any[]).map((q) => q.image).filter((r): r is string => typeof r === 'string'))];
  let next = 0;
  await Promise.all(
    Array.from({ length: FETCH_PARALLEL }, async () => {
      while (next < refs.length) await resolve(refs[next++]).catch(() => {});
    }),
  );

  const imageErrors: ImportError[] = [];
  const questions: Question[] = [];
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
    const unused = zipNames.filter((k) => !used.has(k));
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
