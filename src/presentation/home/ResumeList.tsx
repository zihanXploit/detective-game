import Link from "next/link";
import type { ResumableRoom } from "@/application/use-cases/ListResumableRooms";

/** "2 hours ago", without pulling in a date library for one line of text. */
function sinceLabel(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

const stateLabel = (room: ResumableRoom): string => {
  if (room.status === "COMPLETED") return "Closed";
  if (room.status === "IN_PROGRESS") return "In progress";
  return "In the lobby";
};

export function ResumeList({ rooms }: { rooms: readonly ResumableRoom[] }) {
  if (rooms.length === 0) return null;

  return (
    <section aria-labelledby="resume-heading" className="mb-4">
      <h2 id="resume-heading" className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">
        Carry on
      </h2>
      <ul className="space-y-2">
        {rooms.map((room) => (
          <li key={room.code}>
            <Link
              href={`/room/${room.code}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-ink-700 bg-ink-800 px-4 py-3
                transition-colors hover:border-brass/70
                focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
            >
              <span className="min-w-0">
                <span className="block truncate font-display">{room.caseTitle ?? "No case chosen yet"}</span>
                <span className="block truncate text-xs text-muted">
                  {room.partnerName ? `with ${room.partnerName}` : "on your own so far"} · {stateLabel(room)} ·{" "}
                  {sinceLabel(room.lastActiveAt)}
                </span>
              </span>
              <span className="shrink-0 font-mono text-sm tracking-[0.2em] text-brass">{room.code}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
