FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Instalar dependencias de producción
COPY --from=deps /app/node_modules ./node_modules

# Copiar código
COPY package.json ./
COPY server.js ./
COPY public/ ./public/

# Crear directorios necesarios
RUN mkdir -p uploads deploy

# Usuario no-root (REQUISITO para NaN)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app

USER appuser

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/healthz || exit 1

EXPOSE 3000
CMD ["node", "server.js"]
