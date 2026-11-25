import { createRoom, joinRoom, TestClient, waitFor } from "./TestClient";

/** The case the integration suite plays. Its ids are part of the shipped content. */
export const CASE_SLUG = "night-service-47";
export const INSPECTOR_ITEMS = ["berth-7c", "vestibule-c", "attendant-sheet", "dining-car"] as const;
export const CONTROLLER_ITEMS = ["booking-register", "door-log", "ballast-notice", "crew-roster"] as const;
export const ANSWERS = {
  "who-was-in-7c": "Nia Faro",
  "where-they-left": "Kestrel Siding",
  "who-opened-the-door": "Teodor Vance",
} as const;

export interface Pair {
  code: string;
  host: TestClient;
  guest: TestClient;
  hostCookie: string;
  guestCookie: string;
  close: () => void;
}

/** Two players in a room, both connected to it, nothing chosen yet. */
export async function seatedPair(): Promise<Pair> {
  const created = await createRoom("Inspector");
  const code = created.body.code!;
  const joined = await joinRoom(code, "Controller");

  const host = await TestClient.connect(created.cookie);
  const guest = await TestClient.connect(joined.cookie);
  await host.send("lobby:join", { code });
  await guest.send("lobby:join", { code });

  return {
    code,
    host,
    guest,
    hostCookie: created.cookie,
    guestCookie: joined.cookie,
    close: () => {
      host.close();
      guest.close();
    },
  };
}

/** Takes a seated pair as far as the opening briefing of the real case. */
export async function startedCase(pair: Pair): Promise<void> {
  await pair.host.send("lobby:selectCase", { caseSlug: CASE_SLUG });
  await pair.host.send("lobby:chooseRole", { role: "A" });
  await pair.guest.send("lobby:chooseRole", { role: "B" });
  await pair.host.send("lobby:setReady", { isReady: true });
  await pair.guest.send("lobby:setReady", { isReady: true });
  await pair.host.send("lobby:start", {});
}

/** Both briefings read and every item examined: ready to answer. */
export async function fullyExplored(pair: Pair): Promise<void> {
  await startedCase(pair);
  await pair.host.act({ type: "ACKNOWLEDGE_BRIEFING" });
  await pair.guest.act({ type: "ACKNOWLEDGE_BRIEFING" });
  for (const evidenceId of INSPECTOR_ITEMS) await pair.host.act({ type: "EXAMINE_EVIDENCE", evidenceId });
  for (const evidenceId of CONTROLLER_ITEMS) await pair.guest.act({ type: "EXAMINE_EVIDENCE", evidenceId });
  await waitFor(
    () => pair.host.game?.puzzles.every((puzzle) => puzzle.unlocked) === true,
    "every question to open",
  );
}
