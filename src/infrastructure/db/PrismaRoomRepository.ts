import type { PrismaClient } from "@prisma/client";
import type { RoomRepository } from "@/application/ports";
import { roomCodeTaken, roomFull } from "@/domain/errors";
import { Room, type RoomMember, type Seat } from "@/domain/room/Room";
import type { RoomCode } from "@/domain/room/RoomCode";
import { isUniqueViolation } from "./prisma";

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
          members: {
            create: room.members.map((m) => ({
              playerId: m.playerId,
              seat: m.seat,
              isReady: m.isReady,
              joinedAt: m.joinedAt,
            })),
          },
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
      members: row.members.map((m) => ({
        playerId: m.playerId,
        seat: m.seat as Seat,
        isReady: m.isReady,
        joinedAt: m.joinedAt,
      })),
    });
  }

  async addMember(roomId: string, member: RoomMember): Promise<void> {
    try {
      await this.prisma.roomMember.create({
        data: {
          roomId,
          playerId: member.playerId,
          seat: member.seat,
          isReady: member.isReady,
          joinedAt: member.joinedAt,
        },
      });
    } catch (err) {
      // Someone else took the seat between our read and this write.
      if (isUniqueViolation(err, "seat")) throw roomFull();
      // Same player submitted twice (double click); they are already in.
      if (isUniqueViolation(err)) return;
      throw err;
    }
  }

  async setMemberReady(roomId: string, playerId: string, isReady: boolean): Promise<void> {
    await this.prisma.roomMember.update({
      where: { roomId_playerId: { roomId, playerId } },
      data: { isReady },
    });
  }
}
