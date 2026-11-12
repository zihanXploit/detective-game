"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  LobbyView,
  PlayerRoleView,
  Result,
  ServerToClientEvents,
} from "@/shared/realtime/contract";

type LobbySocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface LobbyState {
  view: LobbyView | null;
  connected: boolean;
  error: string | null;
  /** True once this player has given up their seat. */
  hasLeft: boolean;
}

const INITIAL: LobbyState = { view: null, connected: false, error: null, hasLeft: false };

/** Owns the socket for one room: joins on every (re)connect and mirrors server state. */
export function useLobby(code: string) {
  const socketRef = useRef<LobbySocket | null>(null);
  const [state, setState] = useState<LobbyState>(INITIAL);

  useEffect(() => {
    const socket: LobbySocket = io();
    socketRef.current = socket;

    socket.on("connect", () => {
      // Re-sent after every reconnect, so a dropped connection heals without a page reload.
      socket.emit("lobby:join", { code }, (result) => {
        if (result.ok) setState((s) => ({ ...s, view: result.data, connected: true, error: null }));
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

  const actions = useMemo(() => {
    /** The server broadcasts the new state itself; the ack only matters when it is a refusal. */
    const report = (result: Result<null>) =>
      setState((s) => ({ ...s, error: result.ok ? null : result.error.message }));

    return {
      chooseRole: (role: PlayerRoleView | null) =>
        socketRef.current?.emit("lobby:chooseRole", { role }, report),
      setReady: (isReady: boolean) => socketRef.current?.emit("lobby:setReady", { isReady }, report),
      start: () => socketRef.current?.emit("lobby:start", {}, report),
      leave: () =>
        socketRef.current?.emit("lobby:leave", {}, (result) => {
          if (result.ok) setState((s) => ({ ...s, hasLeft: true }));
          else report(result);
        }),
    };
  }, []);

  return { ...state, ...actions };
}
