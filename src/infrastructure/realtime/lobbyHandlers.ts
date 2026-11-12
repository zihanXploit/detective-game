import type { Server, Socket } from "socket.io";
import type { ZodType } from "zod";
import { DomainError, isDomainError } from "@/domain/errors";
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
import { lobbyJoinSchema, lobbySetReadySchema } from "@/shared/realtime/schemas";

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

  const broadcast = async (code: string): Promise<LobbyView> => {
    const view = await deps.getLobbyView.execute({ code, requesterId: playerId });
    io.to(channel(code)).emit("lobby:state", view);
    return view;
  };

  const leaveCurrentRoom = async () => {
    const previous = await deps.presence.disconnect(socket.id);
    socket.data.roomCode = undefined;
    if (!previous) return;
    await socket.leave(channel(previous));
    await broadcast(previous).catch((err) => console.error("[realtime] leave broadcast failed", err));
  };

  socket.on(
    "lobby:join",
    handle(lobbyJoinSchema, async ({ code: rawCode }) => {
      const code = parseRoomCode(rawCode);
      // Authorisation: throws unless this player holds a seat in the room.
      await deps.getLobbyView.execute({ code, requesterId: playerId });

      if (socket.data.roomCode && socket.data.roomCode !== code) await leaveCurrentRoom();
      await socket.join(channel(code));
      await deps.presence.connect(socket.id, code, playerId);
      socket.data.roomCode = code;
      return broadcast(code);
    }),
  );

  socket.on(
    "lobby:setReady",
    handle(lobbySetReadySchema, async ({ isReady }) => {
      const code = socket.data.roomCode;
      if (!code) throw new DomainError("NOT_ROOM_MEMBER", "Join a room first.");
      await deps.setReady.execute({ code, playerId, isReady });
      await broadcast(code);
      return null;
    }),
  );

  socket.on("disconnect", () => {
    void leaveCurrentRoom();
  });
}
