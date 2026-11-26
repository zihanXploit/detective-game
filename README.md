# Two Lanterns

A cooperative detective game for exactly two players. Each player sees half of
the case and neither can finish alone: the evidence, the briefings and the
answers are split so that the only way through is to talk to each other.

Built with Next.js, React, TypeScript, Tailwind, Socket.IO, PostgreSQL and
Prisma, in a Clean Architecture layout.

## Layout

```
prisma/          schema and migrations
server.ts        entry point: Next.js and Socket.IO on one port
src/
  domain/        rules: rooms, the game engine, cases, puzzle checkers
  application/   use cases and the ports they depend on
  infrastructure/ Prisma, sockets, HTTP, configuration, content catalog
  content/cases/ the cases themselves, as data
  presentation/  React components and hooks
  shared/        the typed contract between browser and server
tests/           integration tests: a real server, database and sockets
```

The domain layer has no dependencies. Everything outside it depends inwards.

## Running it

Requires Node (see `.nvmrc`) and PostgreSQL.

```bash
npm install
cp .env.example .env     # then set SESSION_SECRET and DATABASE_URL
npx prisma migrate deploy
npm run dev
```

The game is at `http://localhost:3000`. To play, open it in two different
browsers, or one normal and one private window, so each gets its own session.

## Tests

```bash
npm run typecheck
npm test                 # unit tests: rules, engine, content
npm run test:integration # starts a real server and plays the game over sockets
```

The integration suite needs its own database, created once:

```sql
CREATE DATABASE detective_test OWNER detective;
```

It wipes whatever it is pointed at, so it refuses to run unless the database
name contains `test` and differs from `DATABASE_URL`. Override the address with
`TEST_DATABASE_URL`.

## Deploying

This needs a host that keeps a process alive. The game serves WebSockets, and
presence, command ordering and per-connection rate limiting all live in the
running process, so a serverless platform will not work. Any container host
will: the `Dockerfile` builds a production image.

Set these in the environment:

| Variable | |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | 32+ random characters; changing it signs every player out |
| `APP_ORIGIN` | the public origin, e.g. `https://example.com`. Required in production: it is what lets the server refuse cross-site socket connections |
| `PORT`, `HOST` | default to `3000` and `0.0.0.0` in the image |

Run migrations as a release step, before the new version starts serving:

```bash
npm run migrate:deploy
```

`GET /api/health` returns 200 when the process can reach its database and 503
when it cannot. Point the host's health check at it.

The server handles `SIGTERM`: it stops accepting connections, closes the open
sockets and releases the database before exiting, so a deploy does not cut a
game off mid-write.

One thing to know before scaling past a single instance: presence, command
ordering and rate limiting are per-process, so two instances would each see
half the picture. Running more than one means moving those to Redis and adding
sticky sessions first.

## Branches

`main` is production, `develop` is integration, and features land on
`feature/*` branches that merge into `develop`.
