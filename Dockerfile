FROM node:22-alpine

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json ./
RUN npm install --production && apk del python3 make g++

COPY server.js db.js ./
COPY public/ ./public/

RUN mkdir -p /app/data/uploads

EXPOSE 3000

CMD ["node", "server.js"]
