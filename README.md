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

## Branches

`main` is production, `develop` is integration, and features land on
`feature/*` branches that merge into `develop`.
