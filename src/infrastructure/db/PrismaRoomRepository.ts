import type { PrismaClient } from "@prisma/client";
import type { RoomRepository } from "@/application/ports";
import { roleTaken, roomCodeTaken, roomFull } from "@/domain/errors";
import { Room, type RoomMember, type Seat } from "@/domain/room/Room";
import type { RoomCode } from "@/domain/room/RoomCode";
import { isUniqueViolation } from "./prisma";

const memberData = (m: RoomMember) => ({
  playerId: m.playerId,
  seat: m.seat,
  role: m.role,
  isReady: m.isReady,
  joinedAt: m.joinedAt,
});

export class PrismaRoomRepository implements RoomRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(room: Room): Promise<void> {
    try {
      await this.prisma.room.create({
        data: {
          id: room.id,
          code: room.code,
          status: room.status,
          hostId: room.hostId,
          caseSlug: room.caseSlug,
          members: { create: room.members.map(memberData) },
        },
      });
    } catch (err) {
      if (isUniqueViolation(err, "code")) throw roomCodeTaken();
      throw err;
    }
  }

  async findByCode(code: RoomCode): Promise<Room | null> {
    const row = await this.prisma.room.findUnique({ where: { code }, include: { members: true } });
    if (!row) return null;

    return new Room({
      id: row.id,
      code: row.code as RoomCode,
      status: row.status,
      hostId: row.hostId,
      caseSlug: row.caseSlug,
      members: row.members.map((m) => ({
        playerId: m.playerId,
        seat: m.seat as Seat,
        role: m.role,
        isReady: m.isReady,
        joinedAt: m.joinedAt,
      })),
    });
  }

  async addMember(roomId: string, member: RoomMember): Promise<void> {
    try {
      await this.prisma.roomMember.create({ data: { roomId, ...memberData(member) } });
    } catch (err) {
      // Someone else took the seat between our read and this write.
      if (isUniqueViolation(err, "seat")) throw roomFull();
      // Same player submitted twice (double click); they are already in.
      if (isUniqueViolation(err)) return;
      throw err;
    }
  }

  async updateMember(roomId: string, member: RoomMember): Promise<void> {
    try {
      await this.prisma.roomMember.update({
        where: { roomId_playerId: { roomId, playerId: member.playerId } },
        data: { role: member.role, isReady: member.isReady },
      });
    } catch (err) {
      if (isUniqueViolation(err, "role")) throw roleTaken();
      throw err;
    }
  }

  async removeMember(room: Room, playerId: string): Promise<void> {
    if (room.isEmpty) {
      // Members and any sessions go with it (ON DELETE CASCADE).
      await this.prisma.room.deleteMany({ where: { id: room.id } });
      return;
    }
    await this.prisma.$transaction([
      this.prisma.room.update({ where: { id: room.id }, data: { hostId: room.hostId } }),
      this.prisma.roomMember.deleteMany({ where: { roomId: room.id, playerId } }),
    ]);
  }

  async saveCaseSelection(room: Room): Promise<void> {
    // One transaction: the new case and the withdrawn readiness must never be visible separately.
    await this.prisma.$transaction([
      this.prisma.room.update({ where: { id: room.id }, data: { caseSlug: room.caseSlug } }),
      ...room.members.map((m) =>
        this.prisma.roomMember.updateMany({
          where: { roomId: room.id, playerId: m.playerId },
          data: { isReady: m.isReady },
        }),
      ),
    ]);
  }

  async markCompleted(roomId: string): Promise<void> {
    await this.prisma.room.updateMany({ where: { id: roomId }, data: { status: "COMPLETED" } });
  }

  async markStarted(roomId: string): Promise<boolean> {
    const { count } = await this.prisma.room.updateMany({
      where: { id: roomId, status: "LOBBY" },
      data: { status: "IN_PROGRESS" },
    });
    return count === 1;
  }
}
