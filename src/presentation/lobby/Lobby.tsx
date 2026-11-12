"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Card, ErrorNote, Wordmark } from "@/presentation/components/ui";
import type { LobbyMemberView, LobbyView } from "@/shared/realtime/contract";
import { RoomUnavailable } from "./RoomUnavailable";
import { roleLabel, SeatCard } from "./SeatCard";
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

function statusLine(view: LobbyView, self: LobbyMemberView, connected: boolean): string {
  if (!connected) return "Reconnecting…";
  if (view.members.length < view.capacity) return "Share the code with your partner to begin.";
  if (view.canStart) return self.isHost ? "Both detectives are ready." : "Waiting for the host to start.";
  if (!self.role) return "Pick a role to continue.";
  if (!self.isReady) return "Ready up when you are set.";
  return "Waiting for your partner.";
}

/** Stand-in for the game screen until the case engine exists. */
function CaseInProgress({ self }: { self: LobbyMemberView }) {
  return (
    <div className="rounded-lg border border-brass/40 bg-brass/10 p-5 text-center">
      <h2 className="font-display text-xl text-brass">The case is open</h2>
      <p className="mt-2 text-sm text-muted">
        You are playing {self.role ? roleLabel(self.role) : "a role"}. The case itself arrives in a later
        milestone; this room is saved and both of you can come back to it.
      </p>
    </div>
  );
}

export function Lobby({ code, selfId }: { code: string; selfId: string }) {
  const router = useRouter();
  const { view, connected, error, hasLeft, chooseRole, setReady, start, leave } = useLobby(code);

  useEffect(() => {
    if (hasLeft) router.replace("/");
  }, [hasLeft, router]);

  const self = view?.members.find((m) => m.playerId === selfId);
  const partner = view?.members.find((m) => m.playerId !== selfId);

  // The seat was given up from another tab.
  if (view && !self) {
    return <RoomUnavailable title="You left this room" detail="Your seat is free again. You can rejoin with the room code." />;
  }

  const inLobby = view?.status === "LOBBY";
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
            {seats.map((member, seat) => {
              const isSelf = member?.playerId === selfId;
              return (
                <SeatCard
                  key={seat}
                  member={member}
                  isSelf={isSelf}
                  picker={
                    isSelf && inLobby
                      ? { takenByPartner: partner?.role ?? null, disabled: !connected, onChoose: chooseRole }
                      : undefined
                  }
                />
              );
            })}
          </div>
        ) : (
          !error && <p className="py-8 text-center text-sm text-muted">Opening the case room…</p>
        )}

        {view && self && !inLobby && <CaseInProgress self={self} />}

        {view && self && inLobby && (
          <div className="flex flex-col gap-3 border-t border-ink-700 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted" aria-live="polite">
              {statusLine(view, self, connected)}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" disabled={!connected} onClick={leave}>
                Leave room
              </Button>
              <Button
                variant={self.isReady ? "ghost" : "primary"}
                disabled={!connected || (!self.isReady && !self.role)}
                onClick={() => setReady(!self.isReady)}
              >
                {self.isReady ? "Not ready" : "I'm ready"}
              </Button>
              {self.isHost && (
                <Button disabled={!connected || !view.canStart} onClick={start}>
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
