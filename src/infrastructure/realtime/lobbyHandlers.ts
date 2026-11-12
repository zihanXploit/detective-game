import type { ZodType } from "zod";
import { notRoomMember, roomNotFound } from "@/domain/errors";
import { parseRoomCode } from "@/domain/room/RoomCode";
import type { RealtimeContainer } from "@/infrastructure/container";
import {
  lobbyChooseRoleSchema,
  lobbyJoinSchema,
  lobbySetReadySchema,
  noPayloadSchema,
} from "@/shared/realtime/schemas";
import type { CommandHandler } from "./commandHandler";
import type { KeyedSerialQueue } from "./KeyedSerialQueue";
import type { RoomGateway } from "./RoomGateway";
import type { GameSocket } from "./types";

export interface RealtimeServices {
  deps: RealtimeContainer;
  gateway: RoomGateway;
  queue: KeyedSerialQueue;
}

export function registerLobbyHandlers(
  socket: GameSocket,
  { deps, gateway, queue }: RealtimeServices,
  command: CommandHandler,
) {
  const { playerId } = socket.data;

  const currentRoom = (): string => {
    if (!socket.data.roomCode) throw notRoomMember();
    return socket.data.roomCode;
  };

  /** Detaches this connection and tells the room, in that room's turn so the update is ordered. */
  const detachAndNotify = async () => {
    const previous = socket.data.roomCode;
    if (!previous) return;
    await queue.run(previous, async () => {
      await gateway.detach(socket);
      await gateway.publishState(previous);
    });
  };

  /** A change to this player's current room, followed by a state update for everyone in it. */
  const mutation = <P>(schema: ZodType<P>, run: (code: string, payload: P) => Promise<void>) =>
    command(schema, currentRoom, async (payload, code) => {
      await run(code, payload);
      await gateway.publishState(code);
      return null;
    });

  socket.on(
    "lobby:join",
    command(
      lobbyJoinSchema,
      ({ code }) => parseRoomCode(code),
      async (_payload, code) => {
        // Authorisation: throws unless this player holds a seat in the room.
        await deps.getLobbyView.execute({ code, requesterId: playerId });

        if (socket.data.roomCode && socket.data.roomCode !== code) await detachAndNotify();
        await gateway.attach(socket, parseRoomCode(code));

        const state = await gateway.publishState(code);
        if (!state) throw roomNotFound();
        return state;
      },
    ),
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
    command(noPayloadSchema, currentRoom, async (_payload, code) => {
      await deps.leaveRoom.execute({ code, playerId });
      // The player may have the room open in several tabs; none may keep receiving its state.
      await gateway.evict(code, playerId);
      await gateway.publishState(code);
      return null;
    }),
  );

  socket.on("disconnect", () => {
    detachAndNotify().catch((err) => console.error("[realtime] disconnect cleanup failed", err));
  });
}
