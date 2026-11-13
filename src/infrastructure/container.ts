import { randomUUID } from "node:crypto";
import type { Clock, IdGenerator } from "@/application/ports";
import { CheckRoomAccess } from "@/application/use-cases/CheckRoomAccess";
import { ChooseRole } from "@/application/use-cases/ChooseRole";
import { CreateRoom } from "@/application/use-cases/CreateRoom";
import { LeaveRoom } from "@/application/use-cases/LeaveRoom";
import { StartCase } from "@/application/use-cases/StartCase";
import { GetGameView } from "@/application/use-cases/GetGameView";
import { GetLobbyView } from "@/application/use-cases/GetLobbyView";
import { PerformGameAction } from "@/application/use-cases/PerformGameAction";
import { IdentifyPlayer } from "@/application/use-cases/IdentifyPlayer";
import { JoinRoom } from "@/application/use-cases/JoinRoom";
import { SetReady } from "@/application/use-cases/SetReady";
import { SelectCase } from "@/application/use-cases/SelectCase";
import { ALL_CASES } from "@/content/cases";
import { StaticCaseCatalog } from "./content/StaticCaseCatalog";
import { PrismaGameSessionRepository } from "./db/PrismaGameSessionRepository";
import { PrismaPlayerRepository } from "./db/PrismaPlayerRepository";
import { PrismaRoomRepository } from "./db/PrismaRoomRepository";
import { getPrisma } from "./db/prisma";
import { InMemoryPresenceTracker } from "./realtime/InMemoryPresenceTracker";
import { CryptoRoomCodeGenerator } from "./security/CryptoRoomCodeGenerator";

/**
 * Composition roots: the only place that knows which concrete classes back the ports.
 *
 * There are two because Next.js bundles route handlers separately from server.ts, so the
 * two halves do not share module instances. Anything stateful and in-memory (presence)
 * therefore belongs to the realtime side only, and HTTP handlers never emit socket events.
 */

const clock: Clock = () => new Date();
const ids: IdGenerator = { next: () => randomUUID() };

function repositories() {
  const prisma = getPrisma();
  return { players: new PrismaPlayerRepository(prisma), rooms: new PrismaRoomRepository(prisma) };
}

/** Stateless and built from code, so each composition root can safely have its own. Throws on invalid content. */
const caseCatalog = () => new StaticCaseCatalog(ALL_CASES);

export function buildHttpContainer() {
  const { players, rooms } = repositories();
  return {
    identifyPlayer: new IdentifyPlayer(players),
    createRoom: new CreateRoom(rooms, new CryptoRoomCodeGenerator(), ids, clock),
    joinRoom: new JoinRoom(rooms, clock),
    checkRoomAccess: new CheckRoomAccess(rooms),
    cases: caseCatalog(),
  };
}
export type HttpContainer = ReturnType<typeof buildHttpContainer>;

const globalForContainer = globalThis as unknown as { httpContainer?: HttpContainer };

export function getHttpContainer(): HttpContainer {
  globalForContainer.httpContainer ??= buildHttpContainer();
  return globalForContainer.httpContainer;
}

export function buildRealtimeContainer() {
  const { players, rooms } = repositories();
  const presence = new InMemoryPresenceTracker();
  const sessions = new PrismaGameSessionRepository(getPrisma());
  const cases = caseCatalog();
  const game = { rooms, sessions, cases };
  return {
    presence,
    getLobbyView: new GetLobbyView(rooms, players, presence),
    chooseRole: new ChooseRole(rooms),
    setReady: new SetReady(rooms),
    selectCase: new SelectCase(rooms, cases),
    startCase: new StartCase(game),
    getGameView: new GetGameView(game),
    performGameAction: new PerformGameAction(game),
    leaveRoom: new LeaveRoom(rooms),
  };
}
export type RealtimeContainer = ReturnType<typeof buildRealtimeContainer>;
