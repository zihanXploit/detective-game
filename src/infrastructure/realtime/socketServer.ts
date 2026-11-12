import type { IncomingMessage, Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { getEnv } from "@/infrastructure/config/env";
import { buildRealtimeContainer } from "@/infrastructure/container";
import { readCookie, SESSION_COOKIE, verifySessionToken } from "@/infrastructure/security/sessionToken";
import { KeyedSerialQueue } from "./KeyedSerialQueue";
import { registerLobbyHandlers, type RealtimeServices } from "./lobbyHandlers";
import { RoomGateway } from "./RoomGateway";
import type { GameServer } from "./types";

/**
 * Browsers attach cookies to cross-site WebSocket handshakes and CORS does not apply to them,
 * so the Origin header must be checked by hand. Requests without an Origin are non-browser
 * clients, which cannot be carrying a victim's cookie.
 */
function isAllowedOrigin(req: IncomingMessage, appOrigin: string | undefined): boolean {
  const origin = req.headers.origin;
  if (!origin) return true;
  if (appOrigin) return origin === appOrigin;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

export function attachRealtime(httpServer: HttpServer): GameServer {
  const env = getEnv();
  const deps = buildRealtimeContainer();

  const io: GameServer = new Server(httpServer, {
    maxHttpBufferSize: 16 * 1024,
    allowRequest: (req, callback) => callback(null, isAllowedOrigin(req, env.APP_ORIGIN)),
  });

  io.use((socket, next) => {
    const token = readCookie(socket.handshake.headers.cookie, SESSION_COOKIE);
    const playerId = token ? verifySessionToken(token, env.SESSION_SECRET) : null;
    if (!playerId) return next(new Error("UNAUTHENTICATED"));
    socket.data.playerId = playerId;
    next();
  });

  const services: RealtimeServices = {
    deps,
    gateway: new RoomGateway(io, deps.presence, deps.getLobbyView),
    queue: new KeyedSerialQueue(),
  };
  io.on("connection", (socket) => registerLobbyHandlers(socket, services));
  return io;
}
