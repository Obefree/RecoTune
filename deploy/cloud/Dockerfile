# Long-running Expo dev server with tunnel (Expo Go from any network).
# Build from repository root: docker build -f deploy/cloud/Dockerfile .

FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN chmod +x deploy/cloud/entrypoint.sh

ENV EXPO_DEVTOOLS_LISTEN_ADDRESS=0.0.0.0
ENV EXPO_NO_TELEMETRY=1

EXPOSE 8081

ENTRYPOINT ["/app/deploy/cloud/entrypoint.sh"]
