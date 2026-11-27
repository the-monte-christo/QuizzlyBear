# QuizzlyBear – Produktions-Image. Gebaut wird vollständig im Container, auf dem Host ist nichts nötig.
#   docker build -t quizzlybear:latest .
#
# Die Node-Version ist bewusst festgeschrieben: 24.22.3 ist das Sicherheits-Release vom 11.11.2026
# und enthält die Korrektur für CVE-2026-111497 („Node2Shell“, Brotli-Decoder, behoben ab 24.22.1).
# Bei jedem neuen Node-Sicherheits-Release hier und in src/server/runtime.ts nachziehen.
ARG NODE_IMAGE=node:24.22.3-bookworm-slim

FROM ${NODE_IMAGE} AS build
WORKDIR /app
# Nur für den Fall, dass es für better-sqlite3 kein fertiges Binary gibt. Die Werkzeuge bleiben in dieser Stufe.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build \
 && npx vitest run --testTimeout 20000
RUN npm prune --omit=dev

FROM ${NODE_IMAGE}
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/schema ./schema
COPY package.json ./
# Schreibt nur nach /data (Volume); alles andere bleibt read-only.
# Das Verzeichnis gehört im Image schon dem Benutzer node, falls kein Volume eingehängt ist.
RUN mkdir /data && chown node:node /data
USER node
EXPOSE 3000
CMD ["node", "dist/server/index.js"]
