# Build with the repository root as context: docker build -f backend/Dockerfile .
FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --include=dev
COPY frontend/ ./
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/ ./
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist
ENV NODE_ENV=production PORT=8000
EXPOSE 8000
CMD ["sh", "-c", "node db/migrate.js && node db/seed.js && exec node src/server.js"]
