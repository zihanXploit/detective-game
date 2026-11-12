import { notRoomMember, roomFull, roomNotJoinable } from "@/domain/errors";
import type { RoomCode } from "./RoomCode";

export const ROOM_CAPACITY = 2;
export type Seat = 0 | 1;
const SEATS: readonly Seat[] = [0, 1];

export type RoomStatus = "LOBBY" | "IN_PROGRESS" | "COMPLETED";

export interface RoomMember {
  readonly playerId: string;
  readonly seat: Seat;
  readonly isReady: boolean;
  readonly joinedAt: Date;
}

export interface RoomProps {
  id: string;
  code: RoomCode;
  status: RoomStatus;
  hostId: string;
  members: RoomMember[];
}

/** Aggregate root for a two-player room. All membership rules live here. */
export class Room {
  readonly id: string;
  readonly code: RoomCode;
  readonly status: RoomStatus;
  readonly hostId: string;
  private memberList: RoomMember[];

  constructor(props: RoomProps) {
    this.id = props.id;
    this.code = props.code;
    this.status = props.status;
    this.hostId = props.hostId;
    this.memberList = [...props.members].sort((a, b) => a.seat - b.seat);
  }

  static open(args: { id: string; code: RoomCode; hostId: string; now: Date }): Room {
    return new Room({
      id: args.id,
      code: args.code,
      status: "LOBBY",
      hostId: args.hostId,
      members: [{ playerId: args.hostId, seat: 0, isReady: false, joinedAt: args.now }],
    });
  }

  get members(): readonly RoomMember[] {
    return this.memberList;
  }

  get isFull(): boolean {
    return this.memberList.length >= ROOM_CAPACITY;
  }

  /** New players can only enter while the room is still gathering in the lobby. */
  get isJoinable(): boolean {
    return this.status === "LOBBY" && !this.isFull;
  }

  get canStart(): boolean {
    return this.status === "LOBBY" && this.isFull && this.memberList.every((m) => m.isReady);
  }

  findMember(playerId: string): RoomMember | undefined {
    return this.memberList.find((m) => m.playerId === playerId);
  }

  /**
   * Lets a player in. Idempotent for existing members, which is what makes
   * refresh, reconnect and "resume later" all the same code path.
   */
  admit(playerId: string, now: Date): { member: RoomMember; isNew: boolean } {
    const existing = this.findMember(playerId);
    if (existing) return { member: existing, isNew: false };

    if (this.status !== "LOBBY") throw roomNotJoinable();
    const seat = SEATS.find((s) => !this.memberList.some((m) => m.seat === s));
    if (seat === undefined) throw roomFull();

    const member: RoomMember = { playerId, seat, isReady: false, joinedAt: now };
    this.memberList = [...this.memberList, member];
    return { member, isNew: true };
  }

  setReady(playerId: string, isReady: boolean): RoomMember {
    const existing = this.findMember(playerId);
    if (!existing) throw notRoomMember();
    if (this.status !== "LOBBY") throw roomNotJoinable();

    const updated: RoomMember = { ...existing, isReady };
    this.memberList = this.memberList.map((m) => (m.playerId === playerId ? updated : m));
    return updated;
  }
}
