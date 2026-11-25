import { z } from "zod";

export const lobbyJoinSchema = z.object({ code: z.string().max(16) });
export const lobbySelectCaseSchema = z.object({ caseSlug: z.string().min(1).max(64) });
export const lobbyChooseRoleSchema = z.object({ role: z.enum(["A", "B"]).nullable() });
export const lobbySetReadySchema = z.object({ isReady: z.boolean() });
export const noPayloadSchema = z.object({}).strict();

/** The hard size cap lives in the domain; this only stops absurd payloads before they get there. */
export const gameActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ACKNOWLEDGE_BRIEFING") }).strict(),
  z.object({ type: z.literal("UPDATE_NOTEBOOK"), text: z.string().max(8000) }).strict(),
]);

/** Body of the create-room and join-room HTTP endpoints. Real name rules are enforced in the domain. */
export const playerNameSchema = z.object({ displayName: z.string().max(64) });
