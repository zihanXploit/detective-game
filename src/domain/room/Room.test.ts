import { describe, expect, it } from "vitest";
import { DomainError } from "@/domain/errors";
import { Room } from "./Room";
import { parseRoomCode } from "./RoomCode";

const now = new Date("2026-01-01T00:00:00Z");
const openRoom = () => Room.open({ id: "r1", code: parseRoomCode("ABCDEF"), hostId: "host", now });

const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (err) {
    if (err instanceof DomainError) return err.code;
    throw err;
  }
  return null;
};

describe("Room", () => {
  it("seats the host first and the guest second", () => {
    const room = openRoom();
    const { member, isNew } = room.admit("guest", now);
    expect(isNew).toBe(true);
    expect(member.seat).toBe(1);
    expect(room.isFull).toBe(true);
  });

  it("re-admits an existing member without taking another seat", () => {
    const room = openRoom();
    room.admit("guest", now);
    expect(room.admit("guest", now).isNew).toBe(false);
    expect(room.members).toHaveLength(2);
  });

  it("rejects a third player", () => {
    const room = openRoom();
    room.admit("guest", now);
    expect(codeOf(() => room.admit("intruder", now))).toBe("ROOM_FULL");
  });

  it("rejects newcomers once the case is in progress but lets members back in", () => {
    const room = new Room({
      id: "r1",
      code: parseRoomCode("ABCDEF"),
      status: "IN_PROGRESS",
      hostId: "host",
      members: [{ playerId: "host", seat: 0, isReady: true, joinedAt: now }],
    });
    expect(codeOf(() => room.admit("guest", now))).toBe("ROOM_NOT_JOINABLE");
    expect(room.admit("host", now).isNew).toBe(false);
  });

  it("can start only when both seats are filled and ready", () => {
    const room = openRoom();
    room.setReady("host", true);
    expect(room.canStart).toBe(false);
    room.admit("guest", now);
    expect(room.canStart).toBe(false);
    room.setReady("guest", true);
    expect(room.canStart).toBe(true);
  });

  it("refuses ready changes from non-members", () => {
    expect(codeOf(() => openRoom().setReady("stranger", true))).toBe("NOT_ROOM_MEMBER");
  });
});

describe("parseRoomCode", () => {
  it("normalises case and whitespace", () => {
    expect(parseRoomCode("  abcdef ")).toBe("ABCDEF");
  });

  it("rejects ambiguous characters and wrong lengths", () => {
    expect(codeOf(() => parseRoomCode("ABCDE0"))).toBe("INVALID_ROOM_CODE");
    expect(codeOf(() => parseRoomCode("ABC"))).toBe("INVALID_ROOM_CODE");
  });
});
