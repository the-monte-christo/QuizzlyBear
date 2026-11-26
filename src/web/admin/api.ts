// Kleiner fetch-Helfer für die Quizmaster-Seite.

export interface ImportError {
  path: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** Detaillierte Fehlerliste beim Quiz-Upload. */
    readonly errors?: ImportError[],
  ) {
    super(message);
  }
}

export async function api<T = any>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    ...rest,
    headers: json !== undefined ? { 'Content-Type': 'application/json', ...rest.headers } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? `Fehler ${res.status}`, res.status, data.errors);
  return data as T;
}

export interface User {
  id: number;
  name: string;
  admin: boolean;
}

export interface QuizSummary {
  id: number;
  title: string;
  description: string;
  owner: string;
  questions: number;
  types: string[];
  updatedAt: number;
}

export interface GameSummary {
  pin: string;
  hostKey: string;
  title: string;
  phase: string;
  players: number;
  createdAt: number;
}
