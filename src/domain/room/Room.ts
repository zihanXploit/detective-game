import {
  notHost,
  notRoomMember,
  roleRequired,
  roleTaken,
  roomFull,
  roomLocked,
  roomNotJoinable,
  roomNotReady,
} from "@/domain/errors";
import type { RoomCode } from "./RoomCode";

export const ROOM_CAPACITY = 2;
export type Seat = 0 | 1;
const SEATS: readonly Seat[] = [0, 1];

/** The two sides of a case. Each case gives them its own names and information. */
export type PlayerRole = "A" | "B";
export const PLAYER_ROLES: readonly PlayerRole[] = ["A", "B"];

export type RoomStatus = "LOBBY" | "IN_PROGRESS" | "COMPLETED";

export interface RoomMember {
  readonly playerId: string;
  readonly seat: Seat;
  readonly role: PlayerRole | null;
  readonly isReady: boolean;
  readonly joinedAt: Date;
}

export interface RoomProps {
  id: string;
  code: RoomCode;
  status: RoomStatus;
  hostId: string;
  /** The case the host picked for this room, if any yet. */
  caseSlug: string | null;
  members: RoomMember[];
}

/** Aggregate root for a two-player room. All membership and lobby rules live here. */
export class Room {
  readonly id: string;
  readonly code: RoomCode;
  private currentStatus: RoomStatus;
  private currentHostId: string;
  private currentCaseSlug: string | null;
  private memberList: RoomMember[];

  constructor(props: RoomProps) {
    this.id = props.id;
    this.code = props.code;
    this.currentStatus = props.status;
    this.currentHostId = props.hostId;
    this.currentCaseSlug = props.caseSlug;
    this.memberList = [...props.members].sort((a, b) => a.seat - b.seat);
  }

  static open(args: { id: string; code: RoomCode; hostId: string; now: Date }): Room {
    return new Room({
      id: args.id,
      code: args.code,
      status: "LOBBY",
      hostId: args.hostId,
      caseSlug: null,
      members: [{ playerId: args.hostId, seat: 0, role: null, isReady: false, joinedAt: args.now }],
    });
  }

  get caseSlug(): string | null {
    return this.currentCaseSlug;
  }

  get status(): RoomStatus {
    return this.currentStatus;
  }

  get hostId(): string {
    return this.currentHostId;
  }

  get members(): readonly RoomMember[] {
    return this.memberList;
  }

  get isFull(): boolean {
    return this.memberList.length >= ROOM_CAPACITY;
  }

  get isEmpty(): boolean {
    return this.memberList.length === 0;
  }

  /** New players can only enter while the room is still gathering in the lobby. */
  get isJoinable(): boolean {
    return this.currentStatus === "LOBBY" && !this.isFull;
  }

  /**
   * Roles are checked explicitly rather than inferred from readiness, so a room
   * can never start with a role uncovered even if stored data is inconsistent.
   */
  get canStart(): boolean {
    const roles = new Set(this.memberList.map((m) => m.role));
    return (
      this.currentStatus === "LOBBY" &&
      this.currentCaseSlug !== null &&
      this.isFull &&
      this.memberList.every((m) => m.isReady && m.role !== null) &&
      roles.size === this.memberList.length
    );
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

    if (this.currentStatus !== "LOBBY") throw roomNotJoinable();
    const seat = SEATS.find((s) => !this.memberList.some((m) => m.seat === s));
    if (seat === undefined) throw roomFull();

    const member: RoomMember = { playerId, seat, role: null, isReady: false, joinedAt: now };
    this.memberList = [...this.memberList, member].sort((a, b) => a.seat - b.seat);
    return { member, isNew: true };
  }

  /** Picking a different role (or none) withdraws readiness: the partner agreed to the old arrangement. */
  chooseRole(playerId: string, role: PlayerRole | null): RoomMember {
    const member = this.lobbyMember(playerId);
    if (role !== null && this.memberList.some((m) => m.playerId !== playerId && m.role === role)) {
      throw roleTaken();
    }
    return this.replace({ ...member, role, isReady: role === member.role ? member.isReady : false });
  }

  setReady(playerId: string, isReady: boolean): RoomMember {
    const member = this.lobbyMember(playerId);
    if (isReady && member.role === null) throw roleRequired();
    return this.replace({ ...member, isReady });
  }

  /**
   * The host's choice of case. Switching to a different case withdraws everyone's
   * readiness: they agreed to play the old one. The caller must check the case exists.
   */
  selectCase(playerId: string, caseSlug: string): void {
    this.lobbyMember(playerId);
    if (playerId !== this.currentHostId) throw notHost();
    if (caseSlug === this.currentCaseSlug) return;

    this.currentCaseSlug = caseSlug;
    this.memberList = this.memberList.map((m) => ({ ...m, isReady: false }));
  }

  /** Frees the seat. If the host walks out, the remaining player inherits the room. */
  leave(playerId: string): void {
    this.lobbyMember(playerId);
    this.memberList = this.memberList.filter((m) => m.playerId !== playerId);

    const heir = this.memberList[0];
    if (playerId === this.currentHostId && heir) this.currentHostId = heir.playerId;
  }

  start(playerId: string): void {
    if (!this.findMember(playerId)) throw notRoomMember();
    if (playerId !== this.currentHostId) throw notHost();
    if (this.currentStatus !== "LOBBY") throw roomLocked();
    if (!this.canStart) throw roomNotReady();
    this.currentStatus = "IN_PROGRESS";
  }

  /** Resolves a member for a lobby-only action. */
  private lobbyMember(playerId: string): RoomMember {
    const member = this.findMember(playerId);
    if (!member) throw notRoomMember();
    if (this.currentStatus !== "LOBBY") throw roomLocked();
    return member;
  }

  private replace(updated: RoomMember): RoomMember {
    this.memberList = this.memberList.map((m) => (m.playerId === updated.playerId ? updated : m));
    return updated;
  }
}
