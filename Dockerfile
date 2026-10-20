# syntax=docker/dockerfile:1.7

FROM node:22.14.0-bookworm-slim AS dependencies

WORKDIR /workspace

ENV COREPACK_HOME=/corepack
ENV PNPM_HOME=/corepack
ENV PATH="/corepack:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

RUN corepack enable && corepack prepare pnpm@10.12.1 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/vscode-extension/package.json apps/vscode-extension/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/integrations/package.json packages/integrations/package.json
COPY packages/ui/package.json packages/ui/package.json

RUN pnpm install --frozen-lockfile --prod=false

FROM dependencies AS build

COPY . .
# These are public browser values embedded by Vite, not server credentials.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
RUN pnpm --filter @projectpulse/web build

FROM nginx:1.27.4-alpine AS runtime

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/nginx-main.conf /etc/nginx/nginx.conf
COPY --from=build /workspace/apps/web/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8080/healthz || exit 1

USER nginx
