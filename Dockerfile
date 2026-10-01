FROM node:20-bookworm-slim AS deps
RUN corepack enable && corepack prepare pnpm@10.17.1 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/gateway/package.json apps/gateway/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/database/package.json packages/database/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY apps apps
COPY packages packages
COPY assets assets
RUN mkdir -p apps/web/public \
    && cp assets/brand/favicon.png apps/web/public/favicon.png
RUN pnpm --filter @myown/database build \
    && pnpm --filter @myown/gateway build \
    && pnpm --filter @myown/web build

FROM node:20-bookworm-slim AS gateway
RUN corepack enable && corepack prepare pnpm@10.17.1 --activate
WORKDIR /app
COPY --from=builder /app /app
ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "apps/gateway/dist/index.js"]

FROM nginx:1.27-alpine AS web
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
