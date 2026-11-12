import type { Server, Socket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "@/shared/realtime/contract";

type NoEvents = Record<string, never>;

export type GameServer = Server<ClientToServerEvents, ServerToClientEvents, NoEvents, SocketData>;
export type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, NoEvents, SocketData>;
