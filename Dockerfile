FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/mobile/package.json apps/mobile/package.json
RUN npm ci --workspace=@rehab/api --workspace=@rehab/core --include-workspace-root
COPY tsconfig.base.json ./
COPY packages/core packages/core
COPY apps/api apps/api
RUN npm run build:api

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/mobile/package.json apps/mobile/package.json
RUN npm ci --omit=dev --workspace=@rehab/api --workspace=@rehab/core --include-workspace-root=false && npm cache clean --force
COPY --from=build /app/apps/api/dist apps/api/dist
USER node
EXPOSE 3000
CMD ["node", "apps/api/dist/server.js"]
