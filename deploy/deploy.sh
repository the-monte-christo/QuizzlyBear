#!/bin/bash
# Spielt den Stand aus ./quelle ein (dorthin wird `git archive HEAD` entpackt):
#   ./deploy.sh            bauen, neu starten, Health-Check
#   ./deploy.sh --force    auch wenn gerade gespielt wird
# Ablauf: Image bauen → laufende Spiele prüfen → Sicherung → Neustart → Health-Check.
# Rückweg: docker tag quizzlybear:vorher quizzlybear:latest && docker compose -f docker-compose.prod.yml up -d
set -euo pipefail
VERZEICHNIS="$(cd "$(dirname "$0")" && pwd)"
cd "$VERZEICHNIS"
[ -f .env ] || { echo "FEHLER: .env fehlt (siehe .env.example)" >&2; exit 1; }
# .env wird NICHT als Shell-Code eingelesen: Docker liest die Datei wörtlich, die Shell würde
# Leerzeichen, $ oder ; in einem Passwort anders deuten (oder ausführen). Gebraucht wird nur der Port.
HAFEN="$(sed -n 's/^APP_PORT=\([0-9][0-9]*\)[[:space:]]*$/\1/p' .env | tail -n 1)"
HAFEN="${HAFEN:-3070}"
ERZWINGEN="${1:-}"
COMPOSE=(docker compose -f docker-compose.prod.yml)
STEMPEL="$(date +%Y%m%d-%H%M%S)"
CONTAINER_UID=1000   # Benutzer „node“ im Image

gesund() { curl -fsS "http://127.0.0.1:$HAFEN/api/health" 2>/dev/null | grep -q '"ok":true'; }
aktive_spiele() { curl -fsS "http://127.0.0.1:$HAFEN/api/health" 2>/dev/null | sed -n 's/.*"activeGames":\([0-9]*\).*/\1/p'; }
pruefe_spiele() {
  # Spiele liegen nur im Arbeitsspeicher: Ein Neustart würde eine laufende Runde beenden.
  local aktiv
  aktiv="$(aktive_spiele || true)"
  if [ "${aktiv:-0}" -gt 0 ] && [ "$ERZWINGEN" != "--force" ]; then
    echo "ABBRUCH: Es laufen gerade $aktiv Spiele. Später erneut versuchen oder mit --force erzwingen." >&2
    exit 2
  fi
}

mkdir -p daten sicherungen
# Der Container läuft als uid 1000 ohne Sonderrechte und schreibt nur nach daten/.
if [ "$(stat -c %u daten)" != "$CONTAINER_UID" ]; then
  chown "$CONTAINER_UID:$CONTAINER_UID" daten 2>/dev/null || {
    echo "FEHLER: daten/ gehört nicht uid $CONTAINER_UID und lässt sich nicht umstellen." >&2
    echo "        Einmalig als root: chown -R $CONTAINER_UID:$CONTAINER_UID $VERZEICHNIS/daten" >&2
    exit 1
  }
fi

echo "== 1. Laufende Spiele =="
pruefe_spiele

echo "== 2. Image bauen =="
[ -d quelle ] || { echo "FEHLER: Ordner quelle fehlt (git archive HEAD | tar -x -C quelle)" >&2; exit 1; }
# „vorher“ zeigt immer auf den letzten Stand, der nachweislich gesund lief – nicht auf einen
# zwischenzeitlich gescheiterten Versuch.
if gesund && docker image inspect quizzlybear:latest >/dev/null 2>&1; then
  docker tag quizzlybear:latest quizzlybear:vorher
fi
docker build --pull -t quizzlybear:latest -t "quizzlybear:$STEMPEL" quelle

echo "== 3. Sicherung =="
# Der Bau dauert Minuten: direkt vor dem Neustart noch einmal nachsehen, ob inzwischen gespielt wird.
pruefe_spiele
if [ -f daten/quizzlybear.sqlite ]; then
  rm -f daten/sicherung.sqlite
  if gesund; then
    # Datenbank im Betrieb: konsistenter Schnappschuss statt Kopie von Datei + WAL
    "${COMPOSE[@]}" exec -T app node -e "require('better-sqlite3')('/data/quizzlybear.sqlite').exec(\"VACUUM INTO '/data/sicherung.sqlite'\")"
  else
    # App läuft nicht: Niemand schreibt, eine Kopie genügt (WAL-Reste mitnehmen)
    cp daten/quizzlybear.sqlite daten/sicherung.sqlite
    for rest in daten/quizzlybear.sqlite-wal daten/quizzlybear.sqlite-shm; do
      [ -f "$rest" ] && cp "$rest" "daten/sicherung.sqlite${rest#daten/quizzlybear.sqlite}"
    done
  fi
  # Bilder ändern sich nie (Dateiname = Hash), sie dürfen bei laufender App gepackt werden
  ( cd daten && tar -czf "../sicherungen/daten-$STEMPEL.tar.gz" sicherung.sqlite* $( [ -d img ] && echo img ) )
  rm -f daten/sicherung.sqlite daten/sicherung.sqlite-wal daten/sicherung.sqlite-shm
  ls -1t sicherungen/daten-*.tar.gz | tail -n +15 | xargs -r rm --
  echo "   sicherungen/daten-$STEMPEL.tar.gz (Datenbank darin heißt sicherung.sqlite)"
fi

echo "== 4. Starten =="
"${COMPOSE[@]}" up -d

echo "== 5. Health-Check =="
for _ in $(seq 1 30); do
  if gesund; then
    echo "   Stand $STEMPEL läuft."
    docker image prune -f > /dev/null 2>&1 || true
    # alte Zeitstempel-Images aufräumen: die drei neuesten bleiben
    docker images quizzlybear --format '{{.Tag}}' | grep -E '^[0-9]{8}-[0-9]{6}$' | sort -r | tail -n +4 \
      | xargs -r -I{} docker rmi "quizzlybear:{}" > /dev/null 2>&1 || true
    exit 0
  fi
  sleep 2
done
echo "FEHLER: nicht gesund." >&2
"${COMPOSE[@]}" logs --tail 40 app >&2
echo "Rückweg: docker tag quizzlybear:vorher quizzlybear:latest && ${COMPOSE[*]} up -d" >&2
exit 1
