FROM node:20

WORKDIR /app

COPY package*.json ./

RUN npm install --legacy-peer-deps
COPY . .

RUN DATABASE_URL=dummy://placeholder npx prisma generate

EXPOSE 5000

CMD ["npm","run","start"]

