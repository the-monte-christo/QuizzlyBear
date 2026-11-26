#!/bin/bash
# Spielt den Stand aus ./quelle ein (dorthin wird `git archive HEAD` entpackt):
#   ./deploy.sh            bauen, neu starten, Health-Check
#   ./deploy.sh --force    auch wenn gerade gespielt wird
# Ablauf: laufende Spiele prüfen → Sicherung → Image bauen → Neustart → Health-Check.
# Rückweg: docker tag quizzlybear:vorher quizzlybear:latest && docker compose -f docker-compose.prod.yml up -d
set -euo pipefail
VERZEICHNIS="$(cd "$(dirname "$0")" && pwd)"
cd "$VERZEICHNIS"
[ -f .env ] || { echo "FEHLER: .env fehlt (siehe .env.example)" >&2; exit 1; }
set -a; . ./.env; set +a
HAFEN="${APP_PORT:-3070}"
COMPOSE=(docker compose -f docker-compose.prod.yml)
STEMPEL="$(date +%Y%m%d-%H%M%S)"
mkdir -p daten sicherungen

echo "== 0. Laufende Spiele =="
# Spiele liegen nur im Arbeitsspeicher: Ein Neustart würde eine laufende Runde beenden.
AKTIV="$(curl -fsS "http://127.0.0.1:$HAFEN/api/health" 2>/dev/null | sed -n 's/.*"activeGames":\([0-9]*\).*/\1/p' || true)"
if [ "${AKTIV:-0}" -gt 0 ] && [ "${1:-}" != "--force" ]; then
  echo "ABBRUCH: Es laufen gerade $AKTIV Spiele. Später erneut versuchen oder mit --force erzwingen." >&2
  exit 2
fi

echo "== 1. Sicherung =="
if [ -n "$(ls -A daten 2>/dev/null)" ]; then
  tar -czf "sicherungen/daten-$STEMPEL.tar.gz" -C daten .
  ls -1t sicherungen/daten-*.tar.gz | tail -n +15 | xargs -r rm --
fi

echo "== 2. Image bauen =="
[ -d quelle ] || { echo "FEHLER: Ordner quelle fehlt (git archive HEAD | tar -x -C quelle)" >&2; exit 1; }
docker image inspect quizzlybear:latest >/dev/null 2>&1 && docker tag quizzlybear:latest quizzlybear:vorher
docker build --pull -t quizzlybear:latest -t "quizzlybear:$STEMPEL" quelle

echo "== 3. Starten =="
"${COMPOSE[@]}" up -d

echo "== 4. Health-Check =="
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$HAFEN/api/health" 2>/dev/null | grep -q '"ok":true'; then
    echo "   Stand $STEMPEL läuft."
    docker image prune -f > /dev/null 2>&1 || true
    exit 0
  fi
  sleep 2
done
echo "FEHLER: nicht gesund." >&2
"${COMPOSE[@]}" logs --tail 40 app >&2
echo "Rückweg: docker tag quizzlybear:vorher quizzlybear:latest && ${COMPOSE[*]} up -d" >&2
exit 1
