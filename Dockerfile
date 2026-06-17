FROM node:20-alpine

WORKDIR /app

# Instalar dependencias
COPY package*.json ./
RUN npm ci --only=production

# Copiar todo el código
COPY . .

# Crear directorios necesarios
RUN mkdir -p uploads deploy

# Puerto que usa la app
EXPOSE 3000

# Arrancar el servidor
CMD ["node", "server.js"]
