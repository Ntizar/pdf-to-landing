# PDF a landing page — Aurora
# Multi-stage, usuario no-root y healthcheck (requisitos de NaN Builders).
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules

# Código: el servidor, el motor de Aurora (src/) y el frontend
COPY package.json ./
COPY server.js ./
COPY src/ ./src/
COPY data/ ./data/
COPY public/ ./public/

# Vistas generadas en caliente (se sirven en /vista/<id>.html)
RUN mkdir -p vistas uploads

# Usuario no-root (REQUISITO para NaN)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
    && chown -R appuser:appgroup /app

USER appuser

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/healthz || exit 1

EXPOSE 3000
CMD ["node", "server.js"]
