export type DomainErrorCode =
  | "INVALID_DISPLAY_NAME"
  | "INVALID_ROOM_CODE"
  | "ROOM_NOT_FOUND"
  | "ROOM_FULL"
  | "ROOM_NOT_JOINABLE"
  | "NOT_ROOM_MEMBER"
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
export const roomCodeTaken = () =>
  new DomainError("ROOM_CODE_TAKEN", "That room code is already in use.");
export const roomCodeExhausted = () =>
  new DomainError("ROOM_CODE_EXHAUSTED", "Could not allocate a room code. Please try again.");
