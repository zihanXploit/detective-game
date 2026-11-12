import type { Server, Socket } from "socket.io";
import type { ZodType } from "zod";
import { isDomainError, notRoomMember, roomNotFound } from "@/domain/errors";
import { parseRoomCode } from "@/domain/room/RoomCode";
import type { RealtimeContainer } from "@/infrastructure/container";
import type {
  Ack,
  ClientToServerEvents,
  LobbyView,
  Result,
  ServerToClientEvents,
  SocketData,
} from "@/shared/realtime/contract";
import {
  lobbyChooseRoleSchema,
  lobbyJoinSchema,
  lobbySetReadySchema,
  noPayloadSchema,
} from "@/shared/realtime/schemas";

type NoEvents = Record<string, never>;
export type GameServer = Server<ClientToServerEvents, ServerToClientEvents, NoEvents, SocketData>;
export type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, NoEvents, SocketData>;

const channel = (code: string) => `room:${code}`;

function toFailure(err: unknown): Result<never> {
  if (isDomainError(err)) {
    return { ok: false, error: { code: err.code, message: err.message } };
  }
  console.error("[realtime] unexpected error", err);
  return { ok: false, error: { code: "INTERNAL", message: "Something went wrong. Please try again." } };
}

/**
 * Wraps a handler so that every event validates its payload, always answers the
 * client's ack, and can never crash the process with an unhandled rejection.
 */
function handle<P, T>(schema: ZodType<P>, run: (payload: P) => Promise<T>) {
  return async (raw: unknown, ack?: Ack<T>) => {
    const reply: Ack<T> = typeof ack === "function" ? ack : () => {};
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      reply({ ok: false, error: { code: "BAD_REQUEST", message: "Malformed request." } });
      return;
    }
    try {
      reply({ ok: true, data: await run(parsed.data) });
    } catch (err) {
      reply(toFailure(err));
    }
  };
}

export function registerLobbyHandlers(io: GameServer, socket: GameSocket, deps: RealtimeContainer) {
  const { playerId } = socket.data;

  /** Pushes the current lobby to everyone in the room. A deleted room has nobody left to tell. */
  const broadcast = async (code: string): Promise<LobbyView | null> => {
    const view = await deps.getLobbyView.snapshot(code);
    if (view) io.to(channel(code)).emit("lobby:state", view);
    return view;
  };

  const currentRoom = (): string => {
    if (!socket.data.roomCode) throw notRoomMember();
    return socket.data.roomCode;
  };

  /** Detaches one connection from its room without touching membership. */
  const detach = async (target: { id: string; data: Partial<SocketData>; leave(room: string): unknown }) => {
    const previous = await deps.presence.disconnect(target.id);
    target.data.roomCode = undefined;
    if (previous) await target.leave(channel(previous));
    return previous;
  };

  const detachAndNotify = async () => {
    const previous = await detach(socket);
    if (previous) await broadcast(previous).catch((err) => console.error("[realtime] broadcast failed", err));
  };

  /** Runs a lobby mutation for this player's current room, then tells the room. */
  const mutation = <P>(schema: ZodType<P>, run: (code: string, payload: P) => Promise<void>) =>
    handle(schema, async (payload) => {
      const code = currentRoom();
      await run(code, payload);
      await broadcast(code);
      return null;
    });

  socket.on(
    "lobby:join",
    handle(lobbyJoinSchema, async ({ code: rawCode }) => {
      const code = parseRoomCode(rawCode);
      // Authorisation: throws unless this player holds a seat in the room.
      await deps.getLobbyView.execute({ code, requesterId: playerId });

      if (socket.data.roomCode && socket.data.roomCode !== code) await detachAndNotify();
      await socket.join(channel(code));
      await deps.presence.connect(socket.id, code, playerId);
      socket.data.roomCode = code;

      const view = await broadcast(code);
      if (!view) throw roomNotFound();
      return view;
    }),
  );

  socket.on(
    "lobby:chooseRole",
    mutation(lobbyChooseRoleSchema, (code, { role }) => deps.chooseRole.execute({ code, playerId, role })),
  );

  socket.on(
    "lobby:setReady",
    mutation(lobbySetReadySchema, (code, { isReady }) => deps.setReady.execute({ code, playerId, isReady })),
  );

  socket.on(
    "lobby:start",
    mutation(noPayloadSchema, (code) => deps.startCase.execute({ code, playerId })),
  );

  socket.on(
    "lobby:leave",
    handle(noPayloadSchema, async () => {
      const code = currentRoom();
      await deps.leaveRoom.execute({ code, playerId });

      // The player may have the room open in several tabs; none of them should keep receiving its state.
      const sockets = await io.in(channel(code)).fetchSockets();
      await Promise.all(sockets.filter((s) => s.data.playerId === playerId).map(detach));
      await broadcast(code);
      return null;
    }),
  );

  socket.on("disconnect", () => {
    void detachAndNotify();
  });
}
