"use client";

import { useState } from "react";
import { Button, Card, ErrorNote, Wordmark } from "@/presentation/components/ui";
import { SeatCard } from "./SeatCard";
import { useLobby } from "./useLobby";

function RoomCodeBadge({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/room/${code}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be denied; the code is on screen to read out instead.
    }
  };

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted">Room code</p>
        <p className="font-mono text-3xl tracking-[0.3em] text-brass">{code}</p>
      </div>
      <Button variant="ghost" onClick={copyInvite}>
        {copied ? "Link copied" : "Copy invite link"}
      </Button>
    </div>
  );
}

export function Lobby({ code, selfId }: { code: string; selfId: string }) {
  const { view, connected, error, setReady } = useLobby(code);

  const self = view?.members.find((m) => m.playerId === selfId);
  const seats = Array.from({ length: view?.capacity ?? 2 }, (_, seat) =>
    view?.members.find((m) => m.seat === seat),
  );

  return (
    <>
      <Wordmark />
      <Card className="space-y-6">
        <RoomCodeBadge code={code} />
        <ErrorNote message={error} />

        {view ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {seats.map((member, seat) => (
              <SeatCard key={seat} member={member} isSelf={member?.playerId === selfId} />
            ))}
          </div>
        ) : (
          !error && <p className="py-8 text-center text-sm text-muted">Opening the case room…</p>
        )}

        {view && self && (
          <div className="flex flex-col gap-3 border-t border-ink-700 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted" aria-live="polite">
              {!connected
                ? "Reconnecting…"
                : view.canStart
                  ? "Both detectives are ready."
                  : view.members.length < view.capacity
                    ? "Share the code with your partner to begin."
                    : "Waiting for both detectives to be ready."}
            </p>
            <div className="flex gap-2">
              <Button
                variant={self.isReady ? "ghost" : "primary"}
                disabled={!connected}
                onClick={() => setReady(!self.isReady)}
              >
                {self.isReady ? "Not ready" : "I'm ready"}
              </Button>
              {self.isHost && (
                <Button disabled title="Cases arrive in the next milestone">
                  Start case
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
