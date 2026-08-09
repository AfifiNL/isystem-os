# Multi-platform manifest digest verified against Docker Hub on 2026-08-09.
FROM node:22.13.1-bookworm-slim@sha256:83fdfa2a4de32d7f8d79829ea259bd6a4821f8b2d123204ac467fbe3966450fc AS dependencies

WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci

FROM dependencies AS build

ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

COPY . .
RUN npm run build

FROM node:22.13.1-bookworm-slim@sha256:83fdfa2a4de32d7f8d79829ea259bd6a4821f8b2d123204ac467fbe3966450fc AS runtime

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV FFMPEG_PATH=/usr/bin/ffmpeg
ENV FFPROBE_PATH=/usr/bin/ffprobe

# npm is needed in the build stage only; keeping its package manager tree in
# the runtime image expands the attack surface without serving the app.
RUN apt-get update \
    && apt-get upgrade --yes --no-install-recommends \
    && apt-get install --yes --no-install-recommends ca-certificates ffmpeg \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx \
    && groupadd --gid 1001 isystem \
    && useradd --uid 1001 --gid isystem --create-home --shell /usr/sbin/nologin isystem

WORKDIR /app
COPY --from=build --chown=isystem:isystem /app/.next/standalone ./

USER isystem
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]

CMD ["node", "server.js"]
