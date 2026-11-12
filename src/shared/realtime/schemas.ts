import { z } from "zod";

export const lobbyJoinSchema = z.object({ code: z.string().max(16) });
export const lobbySetReadySchema = z.object({ isReady: z.boolean() });

/** Body of the create-room and join-room HTTP endpoints. Real name rules are enforced in the domain. */
export const playerNameSchema = z.object({ displayName: z.string().max(64) });
