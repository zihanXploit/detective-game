interface RoomRef {
  code: string;
}

async function post(url: string, displayName: string): Promise<RoomRef> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName }),
    });
  } catch {
    throw new Error("Could not reach the server. Check your connection and try again.");
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = (body as { error?: { message?: string } } | null)?.error?.message;
    throw new Error(message ?? "Something went wrong. Please try again.");
  }
  return body as RoomRef;
}

export const createRoom = (displayName: string) => post("/api/rooms", displayName);

export const joinRoom = (code: string, displayName: string) =>
  post(`/api/rooms/${encodeURIComponent(code.trim().toUpperCase())}/join`, displayName);
