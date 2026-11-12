import { getHttpContainer } from "@/infrastructure/container";
import { readSessionPlayerId } from "@/infrastructure/http/session";
import { JoinPrompt } from "@/presentation/lobby/JoinPrompt";
import { Lobby } from "@/presentation/lobby/Lobby";
import { RoomUnavailable } from "@/presentation/lobby/RoomUnavailable";

export const dynamic = "force-dynamic";

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const playerId = await readSessionPlayerId();
  const access = await getHttpContainer().checkRoomAccess.execute({ code, playerId });

  switch (access.kind) {
    case "member":
      // playerId is non-null here: membership can only be established with a session.
      return <Lobby code={access.code} selfId={playerId!} />;
    case "joinable":
      return <JoinPrompt code={access.code} />;
    case "closed":
      return <RoomUnavailable title="This room is full" detail="Both seats are taken. Ask your partner for a new code, or open a room of your own." />;
    case "not_found":
      return <RoomUnavailable title="No such room" detail="Check the code with your partner. Codes are six characters long." />;
  }
}
