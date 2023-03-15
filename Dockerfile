FROM node:18.12.1-alpine
WORKDIR /app
ADD . .
RUN npm install
CMD node index.js