# Projekt: Eigenes Live-Quiz (Kahoot-artig) für Kollegenrunden

## Rahmen
- Läuft auf eigenem Server, ein einzelner Node-Prozess, kein Cluster.
- Spieler nutzen ausschließlich Handys im Mobilnetz. Keine Betrugsabwehr nötig.
- Stack: Node.js + TypeScript, Socket.io, Frontend mit Vite (Framework frei wählbar),
  SQLite für Nutzer und Quizze, Bilder im Dateisystem.
- Läuft hinter Caddy (HTTPS/wss automatisch).

## Rollen
- Host-Screen (Beamer): Lobby mit PIN + QR-Code, Fragen, Auflösung, Rangliste.
- Spieler (Handy): Beitritt per PIN + Name, Frage und Antwortelemente auf dem Handy.
- Quizmaster: Login, lädt Quizze hoch, startet Runden. Mehrere Quizmaster möglich,
  jedes Quiz hat einen Besitzer.

## Spielablauf
Lobby → pro Frage: Countdown (3 s) → Frage aktiv → Auflösung → Rangliste → … → Endstand.
Der Server ist ein Zustandsautomat, der Host klickt „weiter“.

## Timing
- Frage und Bild-URLs werden während des Countdowns vorab gesendet,
  das Aufdecken passiert lokal auf dem Client.
- Frage und Antworten erscheinen gleichzeitig auf dem Handy.
- Der Client misst die Antwortdauer selbst (performance.now(), vom Erscheinen der
  Antworten bis zum Tap) und schickt sie mit. Der Server übernimmt den Wert.
- Der Server verwirft Antworten nach Ablauf der Zeit + 1 s Kulanz.

## Reconnect
- Spieler-ID + Token in localStorage.
- Beim Reconnect vollständiger State-Resync (Phase, Restzeit, Punktestand,
  bereits abgegebene Antwort).
- Pro Spieler und Frage zählt genau eine Antwort (idempotent).

## Quiz-Format
- Upload: ZIP (quiz.json + Ordner img/) oder reine quiz.json mit Bild-URLs.
- JSON Schema in /schema/quiz.schema.json, Validierung mit ajv,
  verständliche Fehlermeldungen beim Upload.
- Das Schema so dokumentieren, dass man es einer KI zum Erzeugen von Quizzen geben kann.
- Bilder mit sharp auf max. 1280 px als WebP verkleinern, Dateiname = Hash.
- Jede Frage hat: type, text, optional image, time, typspezifisches answer-Objekt.

## Fragetypen
Jeder Typ ist ein eigenes Modul: Schema, Spieler-UI, Host-Auflösung, Punktefunktion.
- Zeitbasiert (nur bei richtiger Antwort): points = round(1000 * (1 - t/T/2))
- Nähebasiert: unabhängig von der Zeit
- Koordinaten auf Bildern immer normiert (0–1)

1. mcsa: eine richtige Antwort (zeitbasiert)
2. mcma: mehrere richtige Antworten (zeitbasiert, Teilpunkte)
3. order: Reihenfolge sortieren (Anteil korrekter Positionen)
4. match: Paare verbinden
5. estimate: Zahl per Slider, Punkte nach relativer Abweichung
6. interval: Bereich wählen. Lösung drin → je schmaler, desto mehr Punkte, sonst 0
7. pin: Punkt aufs Bild setzen, Punkte nach Entfernung
8. circle: Mittelpunkt tippen, Radius ziehen. Lösung drin → je kleiner, desto mehr Punkte
9. poll: Meinungsfrage ohne Punkte. Das Ergebnis kann Lösung einer Folgefrage sein
    („Wie viel Prozent von uns …?“)

Nach pin/circle/lasso zeigt der Host alle Antworten halbtransparent übereinander.

## Vorgehen in Phasen
Die nächste Phase erst beginnen, wenn die vorherige läuft.
1. Grundgerüst, Lobby, Spielablauf, mcsa, Reconnect
2. Upload, Schema, Bildverarbeitung, Quizmaster-Login
3. Die restlichen Typen, jeweils mit Unit-Tests für die Punktefunktion