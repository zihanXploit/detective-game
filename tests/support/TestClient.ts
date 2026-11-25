import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  GameActionPayload,
  GameStateEnvelope,
  LobbyView,
  PlayerGameView,
  Result,
  ServerToClientEvents,
} from "@/shared/realtime/contract";

const baseUrl = () => process.env.TEST_BASE_URL ?? "http://localhost:3100";

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface ApiResult {
  status: number;
  body: { code?: string; error?: { code: string; message: string } };
}

/**
 * The room endpoints are rate limited per client address, and a whole suite
 * coming from one address would trip that limit part way through. Each call
 * presents its own address, the way separate players would. The limit itself
 * is exercised deliberately, from one address, in the lobby tests.
 */
let clientCount = 0;
export const nextClientAddress = () => `10.0.${Math.floor(clientCount / 256) % 256}.${clientCount++ % 256}`;

const post = async (
  path: string,
  displayName: string,
  cookie?: string,
  clientAddress: string = nextClientAddress(),
): Promise<ApiResult & { cookie: string }> => {
  const response = await fetch(`${baseUrl()}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": clientAddress,
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify({ displayName }),
  });
  return {
    status: response.status,
    body: await response.json(),
    cookie: (response.headers.get("set-cookie") ?? "").split(";")[0] ?? "",
  };
};

export const createRoom = (displayName: string, clientAddress?: string) =>
  post("/api/rooms", displayName, undefined, clientAddress);
export const joinRoom = (code: string, displayName: string, cookie?: string, clientAddress?: string) =>
  post(`/api/rooms/${code}/join`, displayName, cookie, clientAddress);

export const fetchHome = (cookie?: string) =>
  fetch(baseUrl(), { headers: cookie ? { cookie } : {} }).then((response) => response.text());

/**
 * One player's connection, with everything the server ever sent it recorded.
 * The recording is what the privacy tests inspect: it is the real wire traffic,
 * not a projection built inside the test.
 */
export class TestClient {
  readonly received: string[] = [];
  lobby: LobbyView | null = null;
  game: PlayerGameView | null = null;
  evictions = 0;

  private constructor(readonly socket: ClientSocket) {}

  static async connect(cookie: string): Promise<TestClient> {
    const socket: ClientSocket = io(baseUrl(), {
      transports: ["websocket"],
      extraHeaders: { cookie },
      forceNew: true,
    });
    const client = new TestClient(socket);

    socket.onAny((event: string, ...args: unknown[]) => client.received.push(event + JSON.stringify(args)));
    socket.on("lobby:state", (state) => {
      client.lobby = state.view;
    });
    socket.on("game:state", (state) => {
      client.game = state.view;
    });
    socket.on("lobby:evicted", () => {
      client.evictions += 1;
    });

    await new Promise<void>((resolve, reject) => {
      socket.once("connect", () => resolve());
      socket.once("connect_error", (error) => reject(error));
    });
    return client;
  }

  /** Sends an event and resolves with the server's acknowledgement. */
  send<T>(event: keyof ClientToServerEvents, payload: unknown): Promise<Result<T>> {
    return new Promise((resolve) => {
      (this.socket.emit as (e: string, p: unknown, ack: (r: Result<T>) => void) => void)(
        event,
        payload,
        (result) => {
          this.received.push(JSON.stringify(result));
          resolve(result);
        },
      );
    });
  }

  act(action: GameActionPayload) {
    return this.send<null>("game:act", action);
  }

  /**
   * Asks for this player's view of the game. The server answers in the
   * acknowledgement rather than by broadcasting, so the reply is recorded here.
   */
  async sync(): Promise<Result<GameStateEnvelope>> {
    const result = await this.send<GameStateEnvelope>("game:sync", {});
    if (result.ok) this.game = result.data.view;
    return result;
  }

  /** Everything this client was ever sent, as one string, for leak checks. */
  get transcript(): string {
    return this.received.join("");
  }

  puzzle(id: string) {
    return this.game?.puzzles.find((p) => p.id === id);
  }

  close(): void {
    this.socket.close();
  }
}

/** Resolves once `predicate` holds, so tests wait on state rather than on a clock. */
export async function waitFor(predicate: () => boolean, what: string, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out waiting for ${what}`);
}

export const failureCode = (result: Result<unknown>) => (result.ok ? null : result.error.code);
