import { invalidRoomCode } from "@/domain/errors";

export type RoomCode = string & { readonly __brand: "RoomCode" };

export const ROOM_CODE_LENGTH = 6;
/** No 0/O, 1/I/L: codes get read aloud and typed by hand. */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const PATTERN = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);

export function parseRoomCode(raw: string): RoomCode {
  const normalised = raw.trim().toUpperCase();
  if (!PATTERN.test(normalised)) throw invalidRoomCode();
  return normalised as RoomCode;
}

export function isRoomCode(raw: string): boolean {
  return PATTERN.test(raw.trim().toUpperCase());
}
