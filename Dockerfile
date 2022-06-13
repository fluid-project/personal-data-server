FROM node:16-alpine

ENV PDS_SKIPDOCKER true

WORKDIR /app

EXPOSE 3000

COPY . /app

RUN npm install

USER node

CMD ["node", "index.js"]
