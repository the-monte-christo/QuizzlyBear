# Deployment auf quizzlybear.blanke.nrw

Vorbereitet, aber noch nicht ausgeführt. Das Image wurde bisher nicht gebaut (auf dem
Entwicklungsrechner gibt es kein Docker); der Produktions-Build selbst ist lokal getestet
(`npm run build`, `npm start`).

## Dateien

| Datei | Ziel auf dem Server |
| --- | --- |
| `docker-compose.prod.yml` | `/opt/quizzlybear/` |
| `deploy.sh` (chmod 755) | `/opt/quizzlybear/` |
| `.env.example` | als `/opt/quizzlybear/.env` (chmod 600), Werte eintragen |
| `nginx/quizzlybear.blanke.nrw` | `/etc/nginx/sites-available/` |
| `nginx/quizzlybear-headers.conf` | `/etc/nginx/snippets/` |

## Ablauf

1. DNS: A-Record `quizzlybear.blanke.nrw` auf den Server.
2. Ordner `/opt/quizzlybear` mit `daten/`, `sicherungen/` und `quelle/` anlegen, Dateien ablegen.
   `daten/` muss uid 1000 gehören (der Container läuft als Benutzer `node` ohne Sonderrechte);
   `deploy.sh` prüft das und sagt, was zu tun ist.
3. Quellcode hochladen und einspielen:
   ```bash
   git archive HEAD | ssh pvtsrv 'rm -rf /opt/quizzlybear/quelle && mkdir -p /opt/quizzlybear/quelle && tar -x -C /opt/quizzlybear/quelle'
   ssh pvtsrv '/opt/quizzlybear/deploy.sh'
   ```
   `git archive` nimmt nur eingecheckte Dateien mit, lokale Geheimnisse bleiben also zu Hause.
4. Zertifikat holen und nginx aktivieren, wie bei den anderen Diensten (erst Port 80 mit
   ACME-Webroot, dann die volle Konfiguration).
5. Ersten Quizmaster anlegen: `ADMIN_USER` und `ADMIN_PASSWORD` in `.env` setzen und den Container
   starten. Das wirkt nur, solange es noch keinen Benutzer gibt. Danach die beiden Zeilen wieder
   entfernen; weitere Quizmaster legt der Admin auf der Quizmaster-Seite an.
6. Abnahme: `curl -s http://127.0.0.1:3070/api/health` liefert `{"ok":true,"activeGames":0}`,
   die Seite lädt über HTTPS, der WebSocket verbindet (Lobby zeigt beitretende Spieler sofort).

## Gut zu wissen

- **Laufende Spiele liegen nur im Arbeitsspeicher.** `deploy.sh` bricht deshalb ab, wenn gerade
  gespielt wird (`activeGames` im Health-Endpunkt), außer mit `--force`.
- **Daten:** `daten/quizzlybear.sqlite` (Benutzer, Sitzungen, Quizze) und `daten/img/` (Bilder).
  `deploy.sh` sichert vor jedem Neustart: die Datenbank als konsistenten Schnappschuss
  (`VACUUM INTO`, im Archiv als `sicherung.sqlite`) und den Bildordner. Für ein eigenes Backup
  genauso vorgehen, nicht die laufende `.sqlite`-Datei kopieren.
- **Rückweg:** `quizzlybear:vorher` zeigt auf den letzten Stand, der gesund lief. Ein gescheiterter
  Versuch überschreibt ihn nicht.
- **.env:** Wird von Docker wörtlich gelesen. Keine Anführungszeichen um Werte setzen.
- **Port:** 3070, nur auf 127.0.0.1.
- **Node-Version:** Das Image ist auf `node:24.22.3-bookworm-slim` festgeschrieben (enthält die
  Korrektur für CVE-2026-111497). Mit einer älteren Version startet die App im Produktionsmodus
  nicht. Bei einem neuen Node-Sicherheits-Release die Version im `Dockerfile` und in
  `src/server/runtime.ts` anheben und neu bauen.
- **Komprimierte Anfragen:** nginx und die App lehnen jede Anfrage mit `Content-Encoding` ab (415).
- **Speicher:** `mem_limit: 384m`. Uploads sind auf 40 MB begrenzt (`MAX_UPLOAD_MB`), nginx lässt
  auf `/api/quizzes` 45 MB durch.
- **Caddy statt nginx:** Die ursprüngliche Aufgabenstellung nennt Caddy. Auf dem Server läuft
  nginx, deshalb liegt hier eine nginx-Konfiguration. Für Caddy genügte
  `reverse_proxy 127.0.0.1:3070` – WebSockets gehen dort ohne Zusatz.
