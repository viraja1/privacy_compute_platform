FROM node:13.14.0

ENV NODE_ENV=development 
ENV PORT=3000

RUN mkdir /usr/src/cache
WORKDIR /usr/src/cache

COPY package.json ./
COPY package-lock.json ./
COPY .npmrc ./
RUN npm install

WORKDIR   /app

EXPOSE $PORT

COPY . /

ENTRYPOINT ["/app/entrypoint.sh"]
