import { describe, expect, it } from "vitest";
import { fetchHome, joinRoom, TestClient, waitFor } from "../support/TestClient";
import { resolveTestDatabaseUrl, testPrisma } from "../support/testDatabase";
import { ANSWERS, fullyExplored, seatedPair } from "../support/scenario";

describe("coming back later", () => {
  it("restores a half-played case after both players disconnect", async () => {
    const pair = await seatedPair();
    try {
      await fullyExplored(pair);
      await pair.host.act({ type: "UPDATE_NOTEBOOK", text: "WHERE-I-GOT-TO" });
      await pair.host.act({ type: "SUBMIT_ANSWER", puzzleId: "who-was-in-7c", answer: ANSWERS["who-was-in-7c"] });
      await waitFor(() => pair.host.puzzle("who-was-in-7c")?.solved === true, "the first answer to land");
      pair.close();

      const returning = await TestClient.connect(pair.hostCookie);
      try {
        await returning.send("lobby:join", { code: pair.code });
        expect((await returning.sync()).ok).toBe(true);

        expect(returning.game?.phase).toBe("INVESTIGATION");
        expect(returning.game?.you.notebook).toBe("WHERE-I-GOT-TO");
        expect(returning.game?.evidence.yours.every((item) => item.examined)).toBe(true);
        expect(returning.puzzle("who-was-in-7c")?.solved).toBe(true);
        expect(returning.puzzle("where-they-left")?.solved).toBe(false);
      } finally {
        returning.close();
      }
    } finally {
      pair.close();
    }
  });

  it("closes the case and the room, and still lets the pair back in", async () => {
    const pair = await seatedPair();
    try {
      await fullyExplored(pair);
      for (const [puzzleId, answer] of Object.entries(ANSWERS)) {
        await pair.host.act({ type: "SUBMIT_ANSWER", puzzleId, answer });
      }
      await waitFor(() => pair.host.game?.phase === "RESOLVED", "the case to close");
      pair.close();

      const prisma = testPrisma(resolveTestDatabaseUrl());
      try {
        const room = await prisma.room.findUnique({ where: { code: pair.code } });
        expect(room?.status).toBe("COMPLETED");
        const session = await prisma.gameSession.findFirst({ where: { roomId: room!.id } });
        expect(session?.status).toBe("COMPLETED");
        expect(session?.completedAt).not.toBeNull();
      } finally {
        await prisma.$disconnect();
      }

      // A closed case is still the pair's to reopen, and is not replaced by a new one.
      const returning = await TestClient.connect(pair.guestCookie);
      try {
        const rejoined = await returning.send("lobby:join", { code: pair.code });
        expect(rejoined.ok).toBe(true);
        expect(returning.lobby?.status).toBe("COMPLETED");

        await returning.sync();
        expect(returning.game?.phase).toBe("RESOLVED");
        expect(returning.game?.puzzles.every((puzzle) => puzzle.solved)).toBe(true);
      } finally {
        returning.close();
      }

      const stranger = await joinRoom(pair.code, "Latecomer");
      expect(stranger.body.error?.code).toBe("ROOM_NOT_JOINABLE");
    } finally {
      pair.close();
    }
  });

  it("lists a player's rooms on the home page, and offers a stranger nothing", async () => {
    const pair = await seatedPair();
    try {
      await fullyExplored(pair);

      const listed = await fetchHome(pair.hostCookie);
      expect(listed).toContain("Carry on");
      expect(listed).toContain(pair.code);
      expect(listed).toContain("Night Service 47");
      expect(listed).toContain("In progress");
      expect(listed).toContain("Controller");

      const anonymous = await fetchHome();
      expect(anonymous).not.toContain("Carry on");
      expect(anonymous).not.toContain(pair.code);
    } finally {
      pair.close();
    }
  });

  it("keeps a player's seat and work across a reconnect mid-game", async () => {
    const pair = await seatedPair();
    try {
      await fullyExplored(pair);
      await pair.guest.act({ type: "UPDATE_NOTEBOOK", text: "CONTROLLER-WORKING-NOTE" });
      await waitFor(() => pair.guest.game?.you.notebook === "CONTROLLER-WORKING-NOTE", "the note to save");

      pair.guest.socket.disconnect();
      await waitFor(
        () => pair.host.lobby?.members.some((m) => !m.isOnline) === true,
        "the host to see the partner drop",
      );

      pair.guest.socket.connect();
      await waitFor(() => pair.guest.socket.connected, "the partner to reconnect");
      await pair.guest.send("lobby:join", { code: pair.code });
      await pair.guest.sync();

      expect(pair.guest.game?.you.notebook).toBe("CONTROLLER-WORKING-NOTE");
      await waitFor(
        () => pair.host.lobby?.members.every((m) => m.isOnline) === true,
        "the host to see the partner return",
      );
    } finally {
      pair.close();
    }
  });
});
