# The app needs a host that keeps a process alive: it serves WebSockets and keeps
# presence, command ordering and rate limiting in memory. This image suits any
# container host; it will not work on a serverless platform.

# ---- build ----------------------------------------------------------------
FROM node:26-alpine AS build
WORKDIR /app

# Dependencies change far less often than source, so install them on their own layer.
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
# A build reaches no database, but configuration is validated when it is read.
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npm run build

# ---- runtime --------------------------------------------------------------
FROM node:26-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOST=0.0.0.0

# Only what is needed to run: the build toolchain stays behind.
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate && npm cache clean --force

COPY --from=build /app/.next ./.next
COPY --from=build /app/next.config.ts ./next.config.ts
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/server.ts ./server.ts
COPY --from=build /app/src ./src

# Do not run as root.
USER node
EXPOSE 3000

# Stop signals are handled by the server itself, so pass them straight to it.
STOPSIGNAL SIGTERM
CMD ["npm", "run", "start"]
