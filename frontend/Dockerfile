FROM node:22-alpine AS base
WORKDIR /app

COPY package.json ./
RUN npm install

COPY tsconfig*.json vite.config.ts tailwind.config.js postcss.config.js index.html ./
COPY public/ ./public/
COPY src/ ./src/

EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
