"use client";

import { Button, ErrorNote } from "@/presentation/components/ui";
import type { RoomSocket } from "@/presentation/lobby/useLobby";
import type { PlayerGameView } from "@/shared/realtime/contract";
import { Notebook } from "./Notebook";
import { useGame } from "./useGame";

function BriefingStatus({ view }: { view: PlayerGameView }) {
  const line = (label: string, done: boolean) => (
    <li className="flex items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <span className={done ? "text-signal" : "text-muted"}>{done ? "Briefing read" : "Still reading"}</span>
    </li>
  );
  return (
    <ul className="space-y-1.5">
      {line(`You (Role ${view.you.role})`, view.you.briefingAcknowledged)}
      {line(`Your partner (Role ${view.partner.role})`, view.partner.briefingAcknowledged)}
    </ul>
  );
}

/**
 * The game screen. It holds the engine's mechanics only (phases and a private
 * notebook); case content will render here once the case system exists.
 */
export function GameScreen({ socket, connected }: { socket: RoomSocket | null; connected: boolean }) {
  const { view, error, act } = useGame(socket, connected);

  if (!view) {
    return (
      <div className="space-y-3">
        <ErrorNote message={error} />
        {!error && <p className="py-6 text-center text-sm text-muted">Opening the case file…</p>}
      </div>
    );
  }

  const inBriefing = view.phase === "BRIEFING";

  return (
    <div className="space-y-5 rounded-lg border border-brass/40 bg-brass/5 p-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted">Phase</p>
        <h2 className="font-display text-xl text-brass">{inBriefing ? "Briefing" : "Investigation"}</h2>
        <p className="mt-1 text-sm text-muted">
          {inBriefing
            ? "No case is loaded yet, so there is nothing to read. Confirm when you are both set."
            : "The investigation is open. Case content arrives in a later milestone."}
        </p>
      </div>

      <ErrorNote message={error} />

      {inBriefing && (
        <>
          <BriefingStatus view={view} />
          <Button
            disabled={!connected || view.you.briefingAcknowledged}
            onClick={() => void act({ type: "ACKNOWLEDGE_BRIEFING" })}
          >
            {view.you.briefingAcknowledged ? "Waiting for your partner…" : "I've read the briefing"}
          </Button>
        </>
      )}

      <Notebook
        saved={view.you.notebook}
        disabled={!connected}
        onSave={(text) => act({ type: "UPDATE_NOTEBOOK", text })}
      />
    </div>
  );
}
