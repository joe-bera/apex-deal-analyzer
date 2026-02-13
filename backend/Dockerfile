FROM node:20-alpine

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci

COPY backend/ .
RUN npm run build

RUN npm prune --production

EXPOSE 3001

CMD ["node", "dist/index.js"]
