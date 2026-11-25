import { getHttpContainer } from "@/infrastructure/container";
import { readSessionPlayerId } from "@/infrastructure/http/session";
import { HomeScreen } from "@/presentation/home/HomeScreen";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const playerId = await readSessionPlayerId();
  const resumable = await getHttpContainer().listResumableRooms.execute(playerId);

  return <HomeScreen resumable={resumable} />;
}
