# One image for the API (serving the built dashboard) and the worker.
# The worker renders with HyperFrames, which needs headless Chromium + FFmpeg.
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg chromium fonts-inter ca-certificates && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium ADLAB_SERVE_WEB=true NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps ./apps
COPY packages ./packages
RUN npm ci && npm run build -w @adlab/web
COPY . .
EXPOSE 8787
CMD ["npx", "tsx", "apps/api/src/main.ts"]
