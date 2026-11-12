import { notRoomMember } from "@/domain/errors";
import { gameActionSchema, noPayloadSchema } from "@/shared/realtime/schemas";
import type { CommandHandler } from "./commandHandler";
import type { RealtimeServices } from "./lobbyHandlers";
import type { GameSocket } from "./types";

/**
 * Game events. Unlike lobby state, nothing here is ever sent to the room channel:
 * each player receives only the view the engine projected for them.
 */
export function registerGameHandlers(
  socket: GameSocket,
  { deps, gateway }: RealtimeServices,
  command: CommandHandler,
) {
  const { playerId } = socket.data;

  const currentRoom = (): string => {
    if (!socket.data.roomCode) throw notRoomMember();
    return socket.data.roomCode;
  };

  socket.on(
    "game:sync",
    command(noPayloadSchema, currentRoom, async (_payload, code) =>
      gateway.stampGameView(await deps.getGameView.execute({ code, playerId })),
    ),
  );

  socket.on(
    "game:act",
    command(gameActionSchema, currentRoom, async (action, code) => {
      const updates = await deps.performGameAction.execute({ code, playerId, action });
      for (const update of updates) gateway.sendGameView(code, update.playerId, update.view);
      return null;
    }),
  );
}
