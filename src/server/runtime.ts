// Mindeststand der Node.js-Laufzeit.
//
// Anlass: CVE-2026-111497 („Node2Shell“), ein Speicherfehler im mitgelieferten Brotli-Decoder,
// behoben in 22.23.4, 24.22.1 und 26.12.1 (Node.js Security Releases vom 21.10.2026). Die Grenzen
// hier liegen beim jeweils folgenden Sicherheits-Release vom 11.11.2026, Stand 27.11.2026.
// Das Problem steckt in der Laufzeit selbst – `npm update` behebt es nicht.
//
// Die App dekodiert zusätzlich nirgends fremde komprimierte Daten (siehe app.ts und quiz/images.ts);
// diese Prüfung ist die zweite Sicherung, nicht die einzige.

const FLOOR: Record<number, [number, number, number]> = {
  22: [22, 23, 5],
  24: [24, 22, 3],
  26: [26, 13, 1],
};
const NEWEST_KNOWN = 26;

export interface NodeStatus {
  ok: boolean;
  message: string;
}

export function nodeStatus(version: string = process.versions.node): NodeStatus {
  const parts = version.split('.').map((p) => parseInt(p, 10));
  const [major] = parts;
  const floor = FLOOR[major];
  if (floor) {
    for (let i = 0; i < 3; i++) {
      if ((parts[i] ?? 0) > floor[i]) break;
      if ((parts[i] ?? 0) < floor[i]) {
        return { ok: false, message: `Node.js ${version} hat bekannte Sicherheitslücken. Mindestens ${floor.join('.')} ist nötig.` };
      }
    }
    return { ok: true, message: `Node.js ${version}` };
  }
  // Neuere Linien als die bekannten enthalten die Korrekturen von Anfang an
  if (major > NEWEST_KNOWN) return { ok: true, message: `Node.js ${version}` };
  return {
    ok: false,
    message: `Node.js ${version} wird nicht mehr mit Sicherheitskorrekturen versorgt. Nötig ist 22.23.5, 24.22.3, 26.13.1 oder neuer.`,
  };
}
