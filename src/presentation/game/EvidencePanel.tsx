"use client";

import { useState, type ReactNode } from "react";
import type { GameActionPayload, OwnEvidenceItemView, SharedEvidenceItemView } from "@/shared/realtime/contract";

type Act = (action: GameActionPayload) => Promise<string | null>;

function Column({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <div>
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted">{title}</h3>
        <p className="text-xs text-muted/80">{hint}</p>
      </div>
      {children}
    </section>
  );
}

function OwnItem({ item, disabled, act }: { item: OwnEvidenceItemView; disabled: boolean; act: Act }) {
  const [busy, setBusy] = useState(false);

  const run = async (action: GameActionPayload) => {
    setBusy(true);
    await act(action);
    setBusy(false);
  };

  return (
    <li className="rounded-lg border border-ink-700 bg-ink-800 p-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-display">{item.name}</span>
        {item.shared && <span className="shrink-0 text-xs text-signal">Shared</span>}
      </div>

      {item.examined ? (
        <>
          <p className="mt-1 text-sm text-muted">{item.summary}</p>
          <div className="mt-2 space-y-1.5 text-sm leading-relaxed">
            {item.details?.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
          </div>
          {!item.shared && (
            <button
              type="button"
              disabled={disabled || busy}
              onClick={() => void run({ type: "SHARE_EVIDENCE", evidenceId: item.id })}
              className="mt-3 rounded-md border border-ink-700 px-3 py-1.5 text-sm font-medium transition-colors
                hover:bg-ink-700/60 disabled:cursor-not-allowed disabled:opacity-50
                focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
            >
              Tell your partner about this
            </button>
          )}
        </>
      ) : (
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => void run({ type: "EXAMINE_EVIDENCE", evidenceId: item.id })}
          className="mt-2 rounded-md bg-brass px-3 py-1.5 text-sm font-semibold text-ink-950 transition-colors
            hover:bg-brass-deep disabled:cursor-not-allowed disabled:opacity-50
            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
        >
          Take a closer look
        </button>
      )}
    </li>
  );
}

interface EvidencePanelProps {
  yours: OwnEvidenceItemView[];
  fromPartner: SharedEvidenceItemView[];
  partnerRoleName: string;
  disabled: boolean;
  act: Act;
}

export function EvidencePanel({ yours, fromPartner, partnerRoleName, disabled, act }: EvidencePanelProps) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Column title="What you can examine" hint="Only you can look at these.">
        <ul className="space-y-2">
          {yours.map((item) => (
            <OwnItem key={item.id} item={item} disabled={disabled} act={act} />
          ))}
        </ul>
      </Column>

      <Column title={`From ${partnerRoleName}`} hint="Ask them to read out what it says.">
        {fromPartner.length === 0 ? (
          <p className="rounded-lg border border-dashed border-ink-700 p-3 text-sm text-muted">
            Nothing yet. Your partner decides what to pass on.
          </p>
        ) : (
          <ul className="space-y-2">
            {fromPartner.map((item) => (
              <li key={item.id} className="rounded-lg border border-ink-700 bg-ink-800 p-3">
                <p className="font-display">{item.name}</p>
                <p className="mt-1 text-sm text-muted">{item.summary}</p>
              </li>
            ))}
          </ul>
        )}
      </Column>
    </div>
  );
}
