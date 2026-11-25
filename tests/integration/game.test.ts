import { describe, expect, it } from "vitest";
import { failureCode, waitFor } from "../support/TestClient";
import {
  ANSWERS,
  CONTROLLER_ITEMS,
  fullyExplored,
  INSPECTOR_ITEMS,
  seatedPair,
  startedCase,
} from "../support/scenario";

describe("playing a case", () => {
  it("holds the pair in the briefing until both have read it", async () => {
    const pair = await seatedPair();
    try {
      await startedCase(pair);
      expect(failureCode(await pair.host.act({ type: "EXAMINE_EVIDENCE", evidenceId: "berth-7c" }))).toBe(
        "INVALID_ACTION",
      );

      await pair.host.act({ type: "ACKNOWLEDGE_BRIEFING" });
      await waitFor(() => pair.guest.game?.partner.briefingAcknowledged === true, "the partner to be shown as ready");
      expect(pair.guest.game?.phase).toBe("BRIEFING");

      await pair.guest.act({ type: "ACKNOWLEDGE_BRIEFING" });
      await waitFor(() => pair.host.game?.phase === "INVESTIGATION", "the investigation to open");
    } finally {
      pair.close();
    }
  });

  it("keeps each side's evidence to itself until it is handed over", async () => {
    const pair = await seatedPair();
    try {
      await startedCase(pair);
      await pair.host.act({ type: "ACKNOWLEDGE_BRIEFING" });
      await pair.guest.act({ type: "ACKNOWLEDGE_BRIEFING" });
      await waitFor(() => pair.host.game?.phase === "INVESTIGATION", "the investigation to open");

      expect(failureCode(await pair.host.act({ type: "EXAMINE_EVIDENCE", evidenceId: "crew-roster" }))).toBe(
        "INVALID_ACTION",
      );
      expect(failureCode(await pair.host.act({ type: "SHARE_EVIDENCE", evidenceId: "berth-7c" }))).toBe(
        "INVALID_ACTION",
      );

      await pair.host.act({ type: "EXAMINE_EVIDENCE", evidenceId: "berth-7c" });
      await waitFor(() => pair.host.game?.evidence.yours[0]?.examined === true, "the item to open");
      expect(pair.host.game?.evidence.yours[0]?.details?.length).toBeGreaterThan(0);
      expect(pair.guest.game?.evidence.fromPartner).toHaveLength(0);

      await pair.host.act({ type: "SHARE_EVIDENCE", evidenceId: "berth-7c" });
      await waitFor(() => pair.guest.game?.evidence.fromPartner.length === 1, "the item to arrive");

      const shared = pair.guest.game?.evidence.fromPartner[0];
      expect(shared?.name).toBe("Berth 7C");
      expect(shared?.summary).toBeTruthy();
      // The point of the mechanic: the detail has to be said out loud.
      expect(shared).not.toHaveProperty("details");
    } finally {
      pair.close();
    }
  });

  it("opens a question only when both sides have found what it needs", async () => {
    const pair = await seatedPair();
    try {
      await startedCase(pair);
      await pair.host.act({ type: "ACKNOWLEDGE_BRIEFING" });
      await pair.guest.act({ type: "ACKNOWLEDGE_BRIEFING" });
      await waitFor(() => pair.host.game?.phase === "INVESTIGATION", "the investigation to open");

      for (const evidenceId of INSPECTOR_ITEMS) await pair.host.act({ type: "EXAMINE_EVIDENCE", evidenceId });
      await waitFor(() => pair.host.game?.evidence.yours.every((i) => i.examined) === true, "the Inspector to finish");

      expect(pair.host.game?.puzzles.every((p) => !p.unlocked)).toBe(true);
      const blocked = pair.host.puzzle("who-was-in-7c")?.blockedBy;
      expect(blocked?.yours).toEqual([]);
      expect(blocked?.partnerItems).toBe(1);
      expect(failureCode(await pair.host.act({ type: "SUBMIT_ANSWER", puzzleId: "who-was-in-7c", answer: "x" })))
        .toBe("INVALID_ACTION");

      await pair.guest.act({ type: "EXAMINE_EVIDENCE", evidenceId: "booking-register" });
      await waitFor(() => pair.host.puzzle("who-was-in-7c")?.unlocked === true, "the first question to open");
      expect(pair.host.puzzle("where-they-left")?.unlocked).toBe(false);
    } finally {
      pair.close();
    }
  });

  it("counts wrong answers, shares hints and closes the case on the last one", async () => {
    const pair = await seatedPair();
    try {
      await fullyExplored(pair);

      await pair.host.act({ type: "SUBMIT_ANSWER", puzzleId: "who-was-in-7c", answer: "Dale Orsk" });
      await waitFor(() => pair.guest.puzzle("who-was-in-7c")?.attempts === 1, "the attempt to be shared");
      expect(pair.guest.puzzle("who-was-in-7c")?.solved).toBe(false);

      await pair.guest.act({ type: "REVEAL_HINT", puzzleId: "who-was-in-7c" });
      await waitFor(() => pair.host.puzzle("who-was-in-7c")?.hints.length === 1, "the hint to reach both");

      for (const [puzzleId, answer] of Object.entries(ANSWERS)) {
        expect((await pair.host.act({ type: "SUBMIT_ANSWER", puzzleId, answer })).ok, puzzleId).toBe(true);
      }
      await waitFor(() => pair.guest.game?.phase === "RESOLVED", "the case to close for both");
      expect(pair.host.game?.puzzles.every((p) => p.solved && p.solvedNote)).toBe(true);

      expect(failureCode(await pair.host.act({ type: "SUBMIT_ANSWER", puzzleId: "who-was-in-7c", answer: "x" })))
        .toBe("INVALID_ACTION");
    } finally {
      pair.close();
    }
  });

  it("refuses malformed and unknown actions", async () => {
    const pair = await seatedPair();
    try {
      await fullyExplored(pair);
      expect(failureCode(await pair.host.act({ type: "WIN_THE_GAME" } as never))).toBe("BAD_REQUEST");
      expect(failureCode(await pair.host.act({ type: "SUBMIT_ANSWER", puzzleId: "ghost", answer: "x" }))).toBe(
        "INVALID_ACTION",
      );
      expect(
        failureCode(await pair.host.act({ type: "UPDATE_NOTEBOOK", text: "x".repeat(9000) })),
      ).toBe("BAD_REQUEST");
    } finally {
      pair.close();
    }
  });

  /**
   * The promise the whole game rests on. This reads the real traffic each
   * client was sent, not a projection rebuilt in the test.
   */
  it("never sends one player anything private to the other", async () => {
    const pair = await seatedPair();
    try {
      await fullyExplored(pair);
      await pair.host.act({ type: "UPDATE_NOTEBOOK", text: "INSPECTOR-PRIVATE-NOTE" });
      await pair.guest.act({ type: "UPDATE_NOTEBOOK", text: "CONTROLLER-PRIVATE-NOTE" });
      // Share everything both ways: the most generous case there is.
      for (const evidenceId of INSPECTOR_ITEMS) await pair.host.act({ type: "SHARE_EVIDENCE", evidenceId });
      for (const evidenceId of CONTROLLER_ITEMS) await pair.guest.act({ type: "SHARE_EVIDENCE", evidenceId });
      for (const [puzzleId, answer] of Object.entries(ANSWERS)) {
        await pair.host.act({ type: "SUBMIT_ANSWER", puzzleId, answer });
      }
      await waitFor(() => pair.guest.game?.phase === "RESOLVED", "the case to close");

      const inspectorOnly = ["N. F.", "crew duty slip", "shot through with flecks", "03:00 round is blank"];
      const controllerOnly = ["Dale Orsk", "ninety-four seconds", "Dunmoor Loop", "214 Teodor Vance"];

      for (const phrase of inspectorOnly) expect(pair.guest.transcript, phrase).not.toContain(phrase);
      for (const phrase of controllerOnly) expect(pair.host.transcript, phrase).not.toContain(phrase);

      expect(pair.guest.transcript).not.toContain("INSPECTOR-PRIVATE-NOTE");
      expect(pair.host.transcript).not.toContain("CONTROLLER-PRIVATE-NOTE");

      // Nor may the answers or the checker configuration ever go out.
      const wire = pair.host.transcript + pair.guest.transcript;
      for (const answer of Object.values(ANSWERS)) expect(wire).not.toContain(`"${answer}"`);
      expect(wire).not.toContain('"accept"');
      expect(wire).not.toContain('"check"');
    } finally {
      pair.close();
    }
  });
});
