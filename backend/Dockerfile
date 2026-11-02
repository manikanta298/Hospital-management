FROM node:20-alpine
WORKDIR /app
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev
COPY backend ./backend
COPY frontend/dist ./frontend/dist
ENV NODE_ENV=production PORT=8000
WORKDIR /app/backend
EXPOSE 8000
CMD ["sh", "-c", "node db/migrate.js && node db/seed.js && node src/server.js"]
