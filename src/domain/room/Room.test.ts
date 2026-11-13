import { describe, expect, it } from "vitest";
import { isDomainError } from "@/domain/errors";
import { Room } from "./Room";
import { parseRoomCode } from "./RoomCode";

const now = new Date("2026-01-01T00:00:00Z");
const openRoom = () => Room.open({ id: "r1", code: parseRoomCode("ABCDEF"), hostId: "host", now });

/** A full lobby with both roles chosen and both players ready. */
const readyRoom = () => {
  const room = openRoom();
  room.admit("guest", now);
  room.selectCase("host", "some-case");
  room.chooseRole("host", "A");
  room.chooseRole("guest", "B");
  room.setReady("host", true);
  room.setReady("guest", true);
  return room;
};

const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (err) {
    if (isDomainError(err)) return err.code;
    throw err;
  }
  return null;
};

describe("Room membership", () => {
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
    const room = readyRoom();
    room.start("host");
    expect(codeOf(() => room.admit("intruder", now))).toBe("ROOM_NOT_JOINABLE");
    expect(room.admit("guest", now).isNew).toBe(false);
  });
});

describe("Room roles and readiness", () => {
  it("refuses a role the partner already holds", () => {
    const room = openRoom();
    room.admit("guest", now);
    room.chooseRole("host", "A");
    expect(codeOf(() => room.chooseRole("guest", "A"))).toBe("ROLE_TAKEN");
    expect(room.chooseRole("guest", "B").role).toBe("B");
  });

  it("requires a role before readying up", () => {
    const room = openRoom();
    expect(codeOf(() => room.setReady("host", true))).toBe("ROLE_REQUIRED");
  });

  it("withdraws readiness when the role changes, but not when it is re-selected", () => {
    const room = openRoom();
    room.chooseRole("host", "A");
    room.setReady("host", true);
    expect(room.chooseRole("host", "A").isReady).toBe(true);
    expect(room.chooseRole("host", "B").isReady).toBe(false);
  });

  it("refuses lobby actions from non-members", () => {
    expect(codeOf(() => openRoom().setReady("stranger", true))).toBe("NOT_ROOM_MEMBER");
    expect(codeOf(() => openRoom().chooseRole("stranger", "A"))).toBe("NOT_ROOM_MEMBER");
  });
});

describe("Room case selection", () => {
  it("cannot start until the host has chosen a case", () => {
    const room = openRoom();
    room.admit("guest", now);
    room.chooseRole("host", "A");
    room.chooseRole("guest", "B");
    room.setReady("host", true);
    room.setReady("guest", true);
    expect(room.canStart).toBe(false);
    expect(codeOf(() => room.start("host"))).toBe("ROOM_NOT_READY");
  });

  it("lets only the host choose, and only in the lobby", () => {
    const room = readyRoom();
    expect(codeOf(() => room.selectCase("guest", "other-case"))).toBe("NOT_HOST");
    expect(codeOf(() => room.selectCase("stranger", "other-case"))).toBe("NOT_ROOM_MEMBER");
    room.start("host");
    expect(codeOf(() => room.selectCase("host", "other-case"))).toBe("ROOM_LOCKED");
  });

  it("withdraws everyone's readiness when the case changes, but not when it is re-selected", () => {
    const room = readyRoom();
    room.selectCase("host", "some-case");
    expect(room.canStart).toBe(true);

    room.selectCase("host", "other-case");
    expect(room.caseSlug).toBe("other-case");
    expect(room.members.every((m) => !m.isReady)).toBe(true);
    expect(room.members.map((m) => m.role)).toEqual(["A", "B"]);
  });

  it("keeps the chosen case when the host leaves", () => {
    const room = readyRoom();
    room.leave("host");
    expect(room.caseSlug).toBe("some-case");
  });
});

describe("Room start", () => {
  it("can start only when both seats are filled and ready", () => {
    const room = openRoom();
    room.selectCase("host", "some-case");
    room.chooseRole("host", "A");
    room.setReady("host", true);
    expect(room.canStart).toBe(false);
    room.admit("guest", now);
    room.chooseRole("guest", "B");
    expect(room.canStart).toBe(false);
    room.setReady("guest", true);
    expect(room.canStart).toBe(true);
  });

  it("cannot start when a stored member is ready but has no role", () => {
    const room = new Room({
      id: "r1",
      code: parseRoomCode("ABCDEF"),
      status: "LOBBY",
      hostId: "host",
      caseSlug: "some-case",
      members: [
        { playerId: "host", seat: 0, role: "A", isReady: true, joinedAt: now },
        { playerId: "guest", seat: 1, role: null, isReady: true, joinedAt: now },
      ],
    });
    expect(room.canStart).toBe(false);
    expect(codeOf(() => room.start("host"))).toBe("ROOM_NOT_READY");
  });

  it("lets only the host start, and only when ready", () => {
    const room = readyRoom();
    expect(codeOf(() => room.start("guest"))).toBe("NOT_HOST");
    room.setReady("guest", false);
    expect(codeOf(() => room.start("host"))).toBe("ROOM_NOT_READY");
    room.setReady("guest", true);
    room.start("host");
    expect(room.status).toBe("IN_PROGRESS");
  });

  it("locks roles, readiness and leaving once started", () => {
    const room = readyRoom();
    room.start("host");
    expect(codeOf(() => room.chooseRole("host", "B"))).toBe("ROOM_LOCKED");
    expect(codeOf(() => room.setReady("guest", false))).toBe("ROOM_LOCKED");
    expect(codeOf(() => room.leave("guest"))).toBe("ROOM_LOCKED");
    expect(codeOf(() => room.start("host"))).toBe("ROOM_LOCKED");
  });
});

describe("Room leaving", () => {
  it("frees the seat and the role for someone else", () => {
    const room = readyRoom();
    room.leave("guest");
    expect(room.isJoinable).toBe(true);
    expect(room.canStart).toBe(false);
    const { member } = room.admit("newcomer", now);
    expect(member.seat).toBe(1);
    expect(room.chooseRole("newcomer", "B").role).toBe("B");
  });

  it("hands the room to the remaining player when the host leaves", () => {
    const room = readyRoom();
    room.leave("host");
    expect(room.hostId).toBe("guest");
    expect(room.admit("newcomer", now).member.seat).toBe(0);
  });

  it("is empty after the last player leaves", () => {
    const room = openRoom();
    room.leave("host");
    expect(room.isEmpty).toBe(true);
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
