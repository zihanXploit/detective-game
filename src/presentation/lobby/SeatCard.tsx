import type { LobbyMemberView } from "@/shared/realtime/contract";

function Tag({ children, tone }: { children: string; tone: "brass" | "muted" | "signal" }) {
  const tones = {
    brass: "border-brass/50 text-brass",
    muted: "border-ink-700 text-muted",
    signal: "border-signal/50 text-signal",
  };
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function SeatCard({ member, isSelf }: { member: LobbyMemberView | undefined; isSelf: boolean }) {
  if (!member) {
    return (
      <div className="flex min-h-28 items-center justify-center rounded-lg border border-dashed border-ink-700 p-4 text-sm text-muted">
        Waiting for your partner…
      </div>
    );
  }

  return (
    <div className="min-h-28 rounded-lg border border-ink-700 bg-ink-800 p-4">
      <div className="flex items-center gap-2">
        <span
          className={`size-2 shrink-0 rounded-full ${member.isOnline ? "bg-signal" : "bg-ink-700"}`}
          aria-hidden
        />
        <span className="truncate font-display text-lg">{member.displayName}</span>
        <span className="sr-only">{member.isOnline ? "online" : "offline"}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {isSelf && <Tag tone="muted">You</Tag>}
        {member.isHost && <Tag tone="brass">Host</Tag>}
        {!member.isOnline && <Tag tone="muted">Away</Tag>}
        <Tag tone={member.isReady ? "signal" : "muted"}>{member.isReady ? "Ready" : "Not ready"}</Tag>
      </div>
    </div>
  );
}
