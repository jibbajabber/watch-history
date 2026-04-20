FROM node:22-bookworm-slim AS base

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json tsconfig.json next.config.ts next-env.d.ts vitest.config.ts ./
RUN npm install

COPY app ./app
COPY components ./components
COPY lib ./lib
COPY public ./public
COPY db ./db
COPY tests ./tests
COPY README.md ./README.md

EXPOSE 3000

CMD ["npm", "run", "dev"]
