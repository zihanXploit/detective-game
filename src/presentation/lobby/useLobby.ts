"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, LobbyView, ServerToClientEvents } from "@/shared/realtime/contract";

type LobbySocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface LobbyState {
  view: LobbyView | null;
  connected: boolean;
  error: string | null;
}

/** Owns the socket for one room: joins on every (re)connect and mirrors server state. */
export function useLobby(code: string) {
  const socketRef = useRef<LobbySocket | null>(null);
  const [state, setState] = useState<LobbyState>({ view: null, connected: false, error: null });

  useEffect(() => {
    const socket: LobbySocket = io();
    socketRef.current = socket;

    socket.on("connect", () => {
      // Re-sent after every reconnect, so a dropped connection heals without a page reload.
      socket.emit("lobby:join", { code }, (result) => {
        if (result.ok) setState({ view: result.data, connected: true, error: null });
        else setState((s) => ({ ...s, connected: false, error: result.error.message }));
      });
    });
    socket.on("lobby:state", (view) => setState((s) => ({ ...s, view })));
    socket.on("disconnect", () => setState((s) => ({ ...s, connected: false })));
    socket.on("connect_error", (err) => {
      const message =
        err.message === "UNAUTHENTICATED"
          ? "Your session has expired. Go back and rejoin the room."
          : "Trying to reach the server…";
      setState((s) => ({ ...s, connected: false, error: message }));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [code]);

  const setReady = useCallback((isReady: boolean) => {
    socketRef.current?.emit("lobby:setReady", { isReady }, (result) => {
      if (!result.ok) setState((s) => ({ ...s, error: result.error.message }));
    });
  }, []);

  return { ...state, setReady };
}
