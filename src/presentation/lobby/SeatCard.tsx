import type { LobbyMemberView, PlayerRoleView } from "@/shared/realtime/contract";

const ROLES: readonly PlayerRoleView[] = ["A", "B"];
/** Placeholder labels: each case will supply its own names for the two sides. */
export const roleLabel = (role: PlayerRoleView) => `Role ${role}`;

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

interface RolePickerProps {
  current: PlayerRoleView | null;
  takenByPartner: PlayerRoleView | null;
  disabled: boolean;
  onChoose: (role: PlayerRoleView | null) => void;
}

function RolePicker({ current, takenByPartner, disabled, onChoose }: RolePickerProps) {
  return (
    <div className="mt-4 flex gap-2" role="group" aria-label="Choose your role">
      {ROLES.map((role) => {
        const selected = current === role;
        const taken = takenByPartner === role;
        return (
          <button
            key={role}
            type="button"
            aria-pressed={selected}
            disabled={disabled || taken}
            title={taken ? "Your partner holds this role" : undefined}
            // Clicking the selected role again hands it back.
            onClick={() => onChoose(selected ? null : role)}
            className={`flex-1 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors
              focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass
              disabled:cursor-not-allowed disabled:opacity-40
              ${selected ? "border-brass bg-brass/15 text-brass" : "border-ink-700 text-paper hover:bg-ink-700/60"}`}
          >
            {roleLabel(role)}
          </button>
        );
      })}
    </div>
  );
}

interface SeatCardProps {
  member: LobbyMemberView | undefined;
  isSelf: boolean;
  /** Present only for the viewer's own seat while the lobby is open. */
  picker?: Omit<RolePickerProps, "current">;
}

export function SeatCard({ member, isSelf, picker }: SeatCardProps) {
  if (!member) {
    return (
      <div className="flex min-h-36 items-center justify-center rounded-lg border border-dashed border-ink-700 p-4 text-sm text-muted">
        Waiting for your partner…
      </div>
    );
  }

  return (
    <div className="min-h-36 rounded-lg border border-ink-700 bg-ink-800 p-4">
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
        {!picker && <Tag tone={member.role ? "brass" : "muted"}>{member.role ? roleLabel(member.role) : "No role yet"}</Tag>}
        <Tag tone={member.isReady ? "signal" : "muted"}>{member.isReady ? "Ready" : "Not ready"}</Tag>
      </div>
      {picker && <RolePicker current={member.role} {...picker} />}
    </div>
  );
}
