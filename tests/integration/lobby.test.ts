import { describe, expect, it } from "vitest";
import { createRoom, failureCode, joinRoom, TestClient, waitFor } from "../support/TestClient";
import { CASE_SLUG, seatedPair, startedCase } from "../support/scenario";

describe("the lobby", () => {
  it("seats two players and refuses a third", async () => {
    const pair = await seatedPair();
    try {
      await waitFor(() => pair.host.lobby?.members.length === 2, "the guest to appear to the host");
      expect(pair.host.lobby?.members.map((m) => m.seat)).toEqual([0, 1]);

      const third = await joinRoom(pair.code, "Intruder");
      expect(third.status).toBe(409);
      expect(third.body.error?.code).toBe("ROOM_FULL");
    } finally {
      pair.close();
    }
  });

  it("rejects a room code that does not exist", async () => {
    const missing = await joinRoom("ZZZZZZ", "Nobody");
    expect(missing.status).toBe(404);
    expect(missing.body.error?.code).toBe("ROOM_NOT_FOUND");
  });

  it("refuses a socket with no session, and one from another origin", async () => {
    await expect(TestClient.connect("")).rejects.toThrow("UNAUTHENTICATED");
  });

  it("will not start until a case, both roles and both readies are in", async () => {
    const pair = await seatedPair();
    try {
      expect(failureCode(await pair.host.send("lobby:start", {}))).toBe("ROOM_NOT_READY");

      await pair.host.send("lobby:selectCase", { caseSlug: CASE_SLUG });
      await pair.host.send("lobby:chooseRole", { role: "A" });
      expect(failureCode(await pair.guest.send("lobby:chooseRole", { role: "A" }))).toBe("ROLE_TAKEN");
      await pair.guest.send("lobby:chooseRole", { role: "B" });

      expect(failureCode(await pair.host.send("lobby:start", {}))).toBe("ROOM_NOT_READY");
      await pair.host.send("lobby:setReady", { isReady: true });
      await pair.guest.send("lobby:setReady", { isReady: true });

      expect(failureCode(await pair.guest.send("lobby:start", {}))).toBe("NOT_HOST");
      expect((await pair.host.send("lobby:start", {})).ok).toBe(true);
    } finally {
      pair.close();
    }
  });

  it("will not let a player ready up without a role", async () => {
    const pair = await seatedPair();
    try {
      expect(failureCode(await pair.host.send("lobby:setReady", { isReady: true }))).toBe("ROLE_REQUIRED");
    } finally {
      pair.close();
    }
  });

  it("withdraws both readies when the host changes the case", async () => {
    const pair = await seatedPair();
    try {
      await pair.host.send("lobby:selectCase", { caseSlug: CASE_SLUG });
      await pair.host.send("lobby:chooseRole", { role: "A" });
      await pair.guest.send("lobby:chooseRole", { role: "B" });
      await pair.host.send("lobby:setReady", { isReady: true });
      await pair.guest.send("lobby:setReady", { isReady: true });
      await waitFor(() => pair.host.lobby?.canStart === true, "both players to be ready");

      await pair.host.send("lobby:selectCase", { caseSlug: "engine-check" });
      await waitFor(() => pair.host.lobby?.canStart === false, "readiness to be withdrawn");
      expect(pair.host.lobby?.members.every((m) => !m.isReady)).toBe(true);
      // Roles survive the change; only the agreement to play does not.
      expect(pair.host.lobby?.members.map((m) => m.role)).toEqual(["A", "B"]);
    } finally {
      pair.close();
    }
  });

  it("hands the room to the other player when the host leaves, and frees the seat", async () => {
    const pair = await seatedPair();
    try {
      await pair.host.send("lobby:chooseRole", { role: "A" });
      expect((await pair.host.send("lobby:leave", {})).ok).toBe(true);

      await waitFor(() => pair.guest.lobby?.members.length === 1, "the host to disappear");
      expect(pair.guest.lobby?.members[0]?.isHost).toBe(true);
      expect(pair.host.evictions).toBe(1);
      expect(pair.guest.evictions).toBe(0);

      // The freed seat is open again, including the role the host had taken.
      const newcomer = await joinRoom(pair.code, "Newcomer");
      expect(newcomer.status).toBe(200);
    } finally {
      pair.close();
    }
  });

  it("locks the lobby once the case has started", async () => {
    const pair = await seatedPair();
    try {
      await startedCase(pair);
      expect(failureCode(await pair.host.send("lobby:selectCase", { caseSlug: "engine-check" }))).toBe(
        "ROOM_LOCKED",
      );
      expect(failureCode(await pair.guest.send("lobby:leave", {}))).toBe("ROOM_LOCKED");

      const latecomer = await joinRoom(pair.code, "Latecomer");
      expect(latecomer.body.error?.code).toBe("ROOM_NOT_JOINABLE");
    } finally {
      pair.close();
    }
  });

  it("stops one client opening rooms without end", async () => {
    const address = "203.0.113.7";
    const outcomes: number[] = [];
    for (let attempt = 0; attempt < 14; attempt++) {
      outcomes.push((await createRoom("Flooder", address)).status);
    }
    expect(outcomes.filter((status) => status === 201).length).toBeLessThanOrEqual(10);
    expect(outcomes.at(-1)).toBe(429);
  });

  it("gives a player back their seat when they come back", async () => {
    const created = await createRoom("Returning");
    const code = created.body.code!;
    // The same session arriving again is the same member, not a second one.
    const again = await joinRoom(code, "Returning", created.cookie);
    expect(again.status).toBe(200);

    const client = await TestClient.connect(created.cookie);
    try {
      const rejoined = await client.send("lobby:join", { code });
      expect(rejoined.ok).toBe(true);
      expect(client.lobby?.members).toHaveLength(1);
    } finally {
      client.close();
    }
  });
});
