"use client";

import { Button, ErrorNote } from "@/presentation/components/ui";
import type { RoomSocket } from "@/presentation/lobby/useLobby";
import type { CaseFileView, PlayerGameView } from "@/shared/realtime/contract";
import { EvidencePanel } from "./EvidencePanel";
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
      {line(`You (${view.caseFile.yourRole.name})`, view.you.briefingAcknowledged)}
      {line(`Your partner (${view.caseFile.partnerRoleName})`, view.partner.briefingAcknowledged)}
    </ul>
  );
}

/** This player's private briefing. The partner's copy holds different text. */
function Briefing({ caseFile }: { caseFile: CaseFileView }) {
  return (
    <section aria-labelledby="briefing-heading" className="rounded-lg border border-ink-700 bg-ink-950/60 p-4">
      <h3 id="briefing-heading" className="text-xs font-medium uppercase tracking-wider text-muted">
        Your briefing · for your eyes only
      </h3>
      <div className="mt-2 space-y-2 text-sm leading-relaxed">
        {caseFile.yourRole.briefing.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
    </section>
  );
}

/** The game screen: the case's briefing for this role, the phase, and a private notebook. */
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
  const { caseFile } = view;

  return (
    <div className="space-y-5 rounded-lg border border-brass/40 bg-brass/5 p-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted">
          {inBriefing ? "Briefing" : "Investigation"}
        </p>
        <h2 className="font-display text-xl text-brass">{caseFile.title}</h2>
        <p className="mt-1 text-sm text-muted">
          You are {caseFile.yourRole.name}. {caseFile.yourRole.summary}
        </p>
      </div>

      <ErrorNote message={error} />
      <Briefing caseFile={caseFile} />

      {!inBriefing && (
        <EvidencePanel
          yours={view.evidence.yours}
          fromPartner={view.evidence.fromPartner}
          partnerRoleName={caseFile.partnerRoleName}
          disabled={!connected}
          act={act}
        />
      )}

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
