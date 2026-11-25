export type DomainErrorCode =
  | "INVALID_DISPLAY_NAME"
  | "INVALID_ROOM_CODE"
  | "ROOM_NOT_FOUND"
  | "ROOM_FULL"
  | "ROOM_NOT_JOINABLE"
  | "NOT_ROOM_MEMBER"
  | "NOT_HOST"
  | "ROOM_LOCKED"
  | "ROOM_NOT_READY"
  | "ROLE_TAKEN"
  | "ROLE_REQUIRED"
  | "CASE_NOT_FOUND"
  | "GAME_NOT_STARTED"
  | "INVALID_ACTION"
  | "STATE_CONFLICT"
  | "ROOM_CODE_TAKEN"
  | "ROOM_CODE_EXHAUSTED";

/** An expected, user-explainable failure. The message is safe to show to players. */
export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

/**
 * Use this instead of `instanceof`. Next.js compiles each route into its own bundle,
 * so an error thrown by a use case built in one bundle is not an instance of the
 * DomainError class loaded by another.
 */
export function isDomainError(err: unknown): err is DomainError {
  return (
    err instanceof Error &&
    err.name === "DomainError" &&
    typeof (err as { code?: unknown }).code === "string"
  );
}

export const invalidDisplayName = () =>
  new DomainError("INVALID_DISPLAY_NAME", "Names must be 2 to 24 characters long.");
export const invalidRoomCode = () =>
  new DomainError("INVALID_ROOM_CODE", "That doesn't look like a valid room code.");
export const roomNotFound = () =>
  new DomainError("ROOM_NOT_FOUND", "No room exists with that code.");
export const roomFull = () => new DomainError("ROOM_FULL", "This room already has two detectives.");
export const roomNotJoinable = () =>
  new DomainError("ROOM_NOT_JOINABLE", "This room is no longer accepting new players.");
export const notRoomMember = () =>
  new DomainError("NOT_ROOM_MEMBER", "You are not a member of this room.");
export const notHost = () => new DomainError("NOT_HOST", "Only the host can do that.");
export const roomLocked = () =>
  new DomainError("ROOM_LOCKED", "That can't be changed once the case has started.");
export const roomNotReady = () =>
  new DomainError("ROOM_NOT_READY", "Choose a case first; both detectives need a role and must be ready.");
export const roleTaken = () =>
  new DomainError("ROLE_TAKEN", "Your partner already holds that role.");
export const roleRequired = () => new DomainError("ROLE_REQUIRED", "Pick a role before readying up.");
export const caseNotFound = () => new DomainError("CASE_NOT_FOUND", "That case is not available.");
export const gameNotStarted = () =>
  new DomainError("GAME_NOT_STARTED", "The case has not been started yet.");
export const invalidAction = (message: string) => new DomainError("INVALID_ACTION", message);
export const stateConflict = () =>
  new DomainError("STATE_CONFLICT", "The case changed while you were acting. Please try again.");
export const roomCodeTaken = () =>
  new DomainError("ROOM_CODE_TAKEN", "That room code is already in use.");
export const roomCodeExhausted = () =>
  new DomainError("ROOM_CODE_EXHAUSTED", "Could not allocate a room code. Please try again.");
