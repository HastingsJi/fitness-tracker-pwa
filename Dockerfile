FROM node:22-alpine

WORKDIR /app
COPY package.json ./
COPY server ./server
COPY icons ./icons
COPY app.js index.html manifest.json service-worker.js styles.css ./

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server/index.js"]
