import { randomInt } from "node:crypto";
import type { RoomCodeGenerator } from "@/application/ports";
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, type RoomCode } from "@/domain/room/RoomCode";

/** Uses a CSPRNG: room codes are the only thing standing between a stranger and a room. */
export class CryptoRoomCodeGenerator implements RoomCodeGenerator {
  generate(): RoomCode {
    let code = "";
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
      code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
    }
    return code as RoomCode;
  }
}
