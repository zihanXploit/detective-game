"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  LobbyView,
  PlayerRoleView,
  Result,
  RoomStateEnvelope,
  ServerToClientEvents,
} from "@/shared/realtime/contract";

type LobbySocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface LobbyState {
  view: LobbyView | null;
  connected: boolean;
  error: string | null;
  /** True once this player no longer holds a seat (they left, here or in another tab). */
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
    let lastSeq = 0;

    /** Applies a snapshot unless something newer is already on screen. */
    const apply = ({ seq, view }: RoomStateEnvelope) => {
      if (seq <= lastSeq) return;
      lastSeq = seq;
      setState((s) => ({ ...s, view, connected: true, error: null }));
    };

    socket.on("connect", () => {
      // A new connection may be to a restarted server whose numbering began again.
      lastSeq = 0;
      // Joining doubles as the resync: the ack carries the latest full snapshot,
      // so whatever was missed while disconnected is replaced in one step.
      socket.emit("lobby:join", { code }, (result) => {
        if (result.ok) apply(result.data);
        else setState((s) => ({ ...s, connected: false, error: result.error.message }));
      });
    });
    socket.on("lobby:state", apply);
    socket.on("lobby:evicted", (payload) => {
      if (payload.code === code) setState((s) => ({ ...s, hasLeft: true }));
    });
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
      // Success arrives as a private "lobby:evicted", the same way it reaches this player's other tabs.
      leave: () => socketRef.current?.emit("lobby:leave", {}, report),
    };
  }, []);

  return { ...state, ...actions };
}
