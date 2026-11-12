"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RoomSocket } from "@/presentation/lobby/useLobby";
import type {
  GameActionPayload,
  GameStateEnvelope,
  PlayerGameView,
  Result,
} from "@/shared/realtime/contract";

export interface GameHookState {
  view: PlayerGameView | null;
  error: string | null;
}

/**
 * Mirrors this player's private view of the game over the room's existing socket.
 * `connected` must be true only once the socket has rejoined the room, so every
 * (re)connection triggers a fresh sync.
 */
export function useGame(socket: RoomSocket | null, connected: boolean) {
  const [state, setState] = useState<GameHookState>({ view: null, error: null });
  const lastSeq = useRef(0);

  useEffect(() => {
    if (!socket || !connected) return;
    // A new connection may be to a restarted server whose numbering began again.
    lastSeq.current = 0;

    const apply = ({ seq, view }: GameStateEnvelope) => {
      if (seq <= lastSeq.current) return;
      lastSeq.current = seq;
      setState({ view, error: null });
    };

    socket.on("game:state", apply);
    socket.emit("game:sync", {}, (result) => {
      if (result.ok) apply(result.data);
      else setState((s) => ({ ...s, error: result.error.message }));
    });

    return () => {
      socket.off("game:state", apply);
    };
  }, [socket, connected]);

  /** Resolves to an error message, or null when the server accepted the action. */
  const act = useCallback(
    (action: GameActionPayload) =>
      new Promise<string | null>((resolve) => {
        if (!socket) return resolve("Not connected.");
        socket.emit("game:act", action, (result: Result<null>) => {
          const message = result.ok ? null : result.error.message;
          setState((s) => ({ ...s, error: message }));
          resolve(message);
        });
      }),
    [socket],
  );

  return { ...state, act };
}
