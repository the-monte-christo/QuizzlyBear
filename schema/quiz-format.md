# QuizzlyBear: Format der quiz.json

Diese Beschreibung ist so geschrieben, dass du sie einer KI geben kannst, zusammen mit dem Auftrag,
ein Quiz zu einem Thema zu erzeugen. Das maschinenlesbare Gegenstück ist
[quiz.schema.json](quiz.schema.json) (JSON Schema, Draft 7). Ein vollständiges Beispiel mit allen
Fragetypen ist [beispiel-quiz.json](beispiel-quiz.json), hochladbar als
[beispiel-quiz.zip](beispiel-quiz.zip).

## Auftrag an eine KI (zum Kopieren)

> Erzeuge ein Quiz im QuizzlyBear-Format zum Thema **[THEMA]** mit **[ANZAHL]** Fragen auf Deutsch.
> Halte dich exakt an die folgende Formatbeschreibung. Gib ausschließlich gültiges JSON aus, ohne
> Kommentare und ohne Text davor oder danach. Mische die Fragetypen. Verwende die Typen `pin` und
> `circle` nur, wenn ich dir Bilder samt Koordinaten nenne. Prüfe jede Lösung auf Richtigkeit.

## Hochladen

| Variante | Inhalt | Bilder |
| --- | --- | --- |
| reine `quiz.json` | nur die JSON-Datei | als `http(s)`-URL im Feld `image` |
| ZIP | `quiz.json` und ein Ordner `img/` | als Pfad relativ zur `quiz.json`, z. B. `img/karte.jpg` |

Bilder werden beim Upload auf höchstens 1280 px verkleinert und als WebP gespeichert. Erlaubt sind
JPEG, PNG, WebP, GIF und AVIF.

## Grundgerüst

```json
{
  "title": "Titel des Quiz",
  "description": "Optionaler Satz für die Übersicht",
  "settings": { },
  "questions": [ ]
}
```

| Feld | Pflicht | Bedeutung |
| --- | --- | --- |
| `title` | ja | 1–80 Zeichen |
| `description` | nein | bis 300 Zeichen |
| `settings` | nein | siehe [Einstellungen](#einstellungen) |
| `questions` | ja | 1–100 Fragen in Spielreihenfolge |

Unbekannte Felder sind ein Fehler. Das fängt Tippfehler wie `"tyme"` statt `"time"` ab.

## Felder jeder Frage

| Feld | Pflicht | Bedeutung |
| --- | --- | --- |
| `type` | ja | einer der neun Fragetypen unten |
| `text` | ja | Fragetext, 1–300 Zeichen, ideal bis etwa 120 |
| `answer` | ja | Objekt, dessen Felder vom Typ abhängen |
| `image` | nur bei `pin` und `circle` | Bild zur Frage (Pfad im ZIP oder URL) |
| `time` | nein | Antwortzeit in Sekunden, 5–300, Standard 20 |
| `points` | nein | Maximalpunkte, 0–5000, Standard 1000 (doppelte Punkte: 2000) |
| `explanation` | nein | ein Satz, der bei der Auflösung unter der Frage erscheint, bis 200 Zeichen |
| `id` | nein | eindeutige Kennung aus Buchstaben, Ziffern, `-` und `_`. Nötig, wenn eine spätere Frage auf eine Umfrage verweist |

Richtwerte für `time`: 15–20 s für einfache Auswahl, 25–30 s für Sortieren, Zuordnen und Schätzen.

## Punkte

- **Zeitbasiert** (`mcsa`, `mcma`, `order`, `match`): `Punkte = round(Maximalpunkte · (1 − t/T/2) · Anteil)`.
  `t` ist die Antwortdauer, `T` die Antwortzeit. Sofort geantwortet gibt volle Punkte, in letzter
  Sekunde die Hälfte. `Anteil` ist bei `mcsa` 0 oder 1, bei den anderen der Teil, der richtig ist.
- **Nähebasiert** (`estimate`, `interval`, `pin`, `circle`): `Punkte = round(Maximalpunkte · Anteil)`,
  unabhängig von der Zeit.
- **Ohne Punkte**: `poll`.

Eine Antwort darf bis zur Sperre geändert werden. Es zählt die letzte Antwort mit ihrer Zeit. Gesperrt
wird, sobald die Zeit abgelaufen ist oder alle geantwortet haben.

**Serie:** Richtige Antworten in Folge werden gezählt und angezeigt. Als richtig gilt bei den
zeitbasierten Typen nur die vollständig richtige Antwort, bei den nähebasierten ein Anteil von
mindestens 0,5. Umfragen verändern die Serie nicht.

## Die neun Fragetypen

### `mcsa`: eine richtige Antwort

```json
{
  "type": "mcsa",
  "text": "Welcher Fisch wird zu Rollmops verarbeitet?",
  "answer": { "options": ["Lachs", "Forelle", "Makrele", "Hering"], "correct": 3 }
}
```

- `options`: 2–6 Texte, je 1–120 Zeichen. Kurz halten, ideal bis 60 Zeichen.
- `correct`: Index der richtigen Option. **Die Zählung beginnt bei 0.**

### `mcma`: mehrere richtige Antworten

```json
{
  "type": "mcma",
  "text": "Welche dieser Tiere sind Fische?",
  "answer": { "options": ["Hering", "Delfin", "Seepferdchen", "Tintenfisch", "Hai"], "correct": [0, 2, 4] }
}
```

- `correct`: Liste aller richtigen Indizes, mindestens einer.
- Anteil = (richtig gewählte − falsch gewählte) / Anzahl richtiger Optionen, mindestens 0. Alles
  anzukreuzen bringt deshalb nichts.

### `order`: Reihenfolge sortieren

```json
{
  "type": "order",
  "text": "Sortiere die Tiere nach ihrer Größe.",
  "answer": { "items": ["Biene", "Hering", "Fuchs", "Grizzlybär"], "first": "kleinstes", "last": "größtes" }
}
```

- `items`: 2–8 Einträge in der **richtigen** Reihenfolge, je bis 80 Zeichen. Gemischt wird automatisch.
- `first`, `last`: optionale Beschriftung der beiden Enden, je bis 24 Zeichen.
- Anteil = Einträge an der richtigen Position / Anzahl der Einträge.
- Die Einträge müssen sich unterscheiden.

### `match`: Paare verbinden

```json
{
  "type": "match",
  "text": "Wer liefert was?",
  "answer": {
    "pairs": [
      { "left": "Biene", "right": "Honig" },
      { "left": "Kuh", "right": "Milch" },
      { "left": "Huhn", "right": "Eier" }
    ]
  }
}
```

- `pairs`: 2–6 Paare, `left` und `right` je bis 50 Zeichen. Die rechte Seite wird gemischt.
- Anteil = richtig zugeordnete Paare / Anzahl der Paare.
- Kein Text darf links oder rechts doppelt vorkommen.

### `estimate`: Zahl schätzen

```json
{
  "type": "estimate",
  "text": "Wie viel Prozent der Erdoberfläche sind von Wasser bedeckt?",
  "answer": { "min": 0, "max": 100, "correct": 71, "unit": "%" }
}
```

- `min`, `max`: Enden des Schiebereglers. `correct` muss dazwischen liegen und sollte nicht genau in
  der Mitte sein, weil der Regler dort startet.
- `unit`: optionale Einheit, bis 12 Zeichen.
- `step`: optionale Schrittweite. Ohne Angabe wird eine passende gewählt (rund 100–200 Schritte).
- `tolerance`: optional, Standard `0.25`. Abweichung als Anteil der Skalenbreite, ab der es 0 Punkte gibt.
- Anteil = `1 − (|Schätzung − Lösung| / (max − min)) / tolerance`, mindestens 0. Beispiel oben: Wer
  61 % schätzt, liegt 10 % der Skala daneben und bekommt 600 von 1000 Punkten.

### `interval`: Bereich wählen

```json
{
  "type": "interval",
  "text": "In welchem Jahr fiel die Berliner Mauer? Wähle einen Bereich.",
  "answer": { "min": 1950, "max": 2020, "correct": 1989 }
}
```

- Felder wie bei `estimate`, ohne `tolerance`.
- Die Spieler wählen „von“ und „bis“. Liegt die Lösung im Bereich: Anteil = `1 − Breite / (max − min)`.
  Sonst 0 Punkte. Je schmaler der Bereich, desto mehr Punkte.

### `pin`: Punkt aufs Bild setzen

```json
{
  "type": "pin",
  "text": "Tippe auf die Himbeere.",
  "image": "img/sticker.jpg",
  "answer": { "x": 0.622, "y": 0.815, "tolerance": 0.07, "maxDistance": 0.3 }
}
```

- `image` ist Pflicht.
- Das Ziel ist **entweder ein Punkt** (`x` und `y`) **oder eine Fläche** (`area`), nicht beides.
- `x`, `y`: Ziel als **normierte Koordinaten von 0 bis 1**. `x: 0` ist der linke Rand, `x: 1` der
  rechte, `y: 0` der obere, `y: 1` der untere. Die Bildmitte ist `0.5 / 0.5`.
- Umrechnung aus Pixeln: `x = Pixel_x / Bildbreite`, `y = Pixel_y / Bildhöhe`.
- `tolerance`: optional. Abstand in **Bildbreiten**, bis zu dem es volle Punkte gibt. Standard beim
  Punkt `0.04`, bei einer Fläche `0`.
- `maxDistance`: optional. Abstand, ab dem es 0 Punkte gibt. Dazwischen fallen die Punkte linear.
  Standard beim Punkt `0.3`, bei einer Fläche `0.15`.

**Ziel als Fläche** – für ein Land auf einer Karte oder einen Gegenstand im Wimmelbild:

```json
{
  "type": "pin",
  "text": "Tippe auf eine rote Frucht.",
  "image": "img/sticker.jpg",
  "answer": {
    "area": [
      [[0.095, 0.39], [0.23, 0.39], [0.23, 0.615], [0.095, 0.615]],
      [[0.765, 0.39], [0.93, 0.39], [0.93, 0.61], [0.765, 0.61]]
    ],
    "maxDistance": 0.1
  }
}
```

- `area` ist eine Liste von Vielecken. Jedes Vieleck ist eine Liste von Eckpunkten `[x, y]`, der
  Reihe nach am Umriss entlang, mindestens drei. Es wird automatisch geschlossen.
- Ein Treffer in einem der Vielecke gibt volle Punkte. Mehrere Vielecke braucht man für getrennte
  Teile, etwa ein Land mit Inseln oder mehrere gültige Ziele.
- Außerhalb zählt der Abstand zur nächsten Kante: bis `tolerance` volle Punkte, ab `maxDistance` keine.
- Löcher in einer Fläche gibt es nicht. Der Umriss darf sich nicht selbst überkreuzen.
- **Koordinaten nicht von Hand ausrechnen:** Die Quizmaster-Seite hat einen Koordinaten-Helfer. Bild
  wählen, Umriss anklicken, das fertige `answer`-Objekt kopieren.

### `circle`: Kreis ziehen

```json
{
  "type": "circle",
  "text": "Kreise die Biene ein – so eng wie möglich.",
  "image": "img/sticker.jpg",
  "answer": { "x": 0.624, "y": 0.198 }
}
```

- `image` ist Pflicht. `x`, `y` wie bei `pin`.
- Die Spieler tippen den Mittelpunkt und ziehen den Radius auf.
- `minRadius`: optional, Standard `0.04`. `maxRadius`: optional, Standard `0.4`. Beides in Bildbreiten.
- Liegt die Lösung im Kreis: Anteil fällt linear von 1 (kleinster Radius) auf 0 (größter Radius).
  Liegt sie außerhalb: 0 Punkte.

Bei `pin` und `circle` zeigt der Host-Screen bei der Auflösung alle Antworten halbtransparent übereinander.

### `poll`: Umfrage

```json
{
  "id": "honig",
  "type": "poll",
  "text": "Hand aufs Herz: Wie oft isst du Honig?",
  "answer": { "options": ["Fast täglich", "Ab und zu", "So gut wie nie"] }
}
```

- 2–6 Optionen, keine richtige Antwort, keine Punkte.

**Umfrage-Ergebnis als Lösung einer späteren Frage:** Gib der Umfrage eine `id` und verweise in einer
späteren `estimate`- oder `interval`-Frage darauf:

```json
{
  "type": "estimate",
  "text": "Wie viel Prozent von uns essen fast täglich Honig?",
  "answer": { "min": 0, "max": 100, "correct": { "poll": "honig", "option": 0 }, "unit": "%" }
}
```

Die Lösung ist dann der Prozentanteil (0–100, gerundet) der Spieler, die in dieser Runde Option 0
gewählt haben. Die Skala muss 0 bis 100 abdecken, die Umfrage muss vorher im Quiz stehen.

## Einstellungen

Alle Angaben sind optional. Hier stehen die Standardwerte:

```json
"settings": {
  "phone": { "showQuestion": true, "showAnswerText": true },
  "streak": { "bonus": 0, "max": 500 },
  "ranking": { "reveal": [3, 2, 1], "tiebreak": ["correct", "time", "streak"], "top": 5 }
}
```

| Feld | Bedeutung |
| --- | --- |
| `phone.showQuestion` | `true`: Fragetext und Fragebild erscheinen auch auf dem Handy. `false`: Die Frage steht nur auf dem großen Bildschirm. Der Host kann das im Spiel umschalten |
| `phone.showAnswerText` | `false`: Auf dem Handy erscheinen bei Auswahlfragen nur Farbe und Symbol |
| `streak.bonus` | Bonuspunkte je Serien-Stufe ab der zweiten richtigen Antwort in Folge. `100` bedeutet: 2 in Folge +100, 3 in Folge +200 usw. `0` = kein Bonus |
| `streak.max` | Obergrenze des Bonus pro Frage |
| `ranking.reveal` | **Siegerreihenfolge:** die Plätze in der Reihenfolge, in der sie bei der Siegerehrung enthüllt werden. `[3, 2, 1]` ist klassisch, `[1, 2, 3]` zeigt den Sieger zuerst, `[5, 4, 3, 2, 1]` ehrt die Top 5. Jeder Platz höchstens einmal |
| `ranking.tiebreak` | Reihenfolge der Kriterien bei Punktgleichheit: `correct` (mehr richtige Antworten), `time` (kürzere Gesamtzeit), `streak` (längste Serie), `name` (alphabetisch) |
| `ranking.top` | Zeilen der Zwischen-Rangliste nach jeder Frage, 3–8 |

## Häufige Fehler

- `correct` zählt ab 0. Bei vier Optionen ist die letzte `3`, nicht `4`.
- `order.items` steht in der richtigen Reihenfolge, nicht gemischt.
- Koordinaten bei `pin` und `circle` liegen zwischen 0 und 1, es sind keine Pixel.
- `area` hat drei Klammer-Ebenen: Liste der Vielecke, Vieleck, Eckpunkt. Auch ein einzelnes Vieleck
  steht in der äußeren Liste: `"area": [[[0.2, 0.3], [0.5, 0.3], [0.5, 0.6]]]`.
- Ein Verweis auf eine Umfrage braucht deren `id`, und die Umfrage muss weiter oben stehen.
- Zahlen stehen ohne Anführungszeichen: `"correct": 71`, nicht `"correct": "71"`.
- Kein Komma nach dem letzten Eintrag einer Liste oder eines Objekts.
- Bildpfade wie `img/foto.jpg` funktionieren nur im ZIP. In einer reinen `quiz.json` muss eine URL stehen.

Beim Upload nennt die Quizmaster-Seite jeden Fehler mit Fundstelle, zum Beispiel
„Frage 3 (mcsa) · answer.correct: Hier wird eine ganze Zahl erwartet.“
