FROM node:20-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/database ./packages/database
COPY apps/api ./apps/api
RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter @educore/database generate
RUN pnpm --filter @educore/api build

FROM node:20-alpine
WORKDIR /app
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages/database ./node_modules/@educore/database
EXPOSE 4000
CMD ["node", "dist/main.js"]
