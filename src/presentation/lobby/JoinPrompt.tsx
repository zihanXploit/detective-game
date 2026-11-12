"use client";

import type { FormEvent } from "react";
import { joinRoom } from "@/presentation/api/roomsApi";
import { Button, Card, ErrorNote, TextField, Wordmark } from "@/presentation/components/ui";
import { useDisplayName } from "@/presentation/hooks/useDisplayName";
import { useRoomEntry } from "@/presentation/hooks/useRoomEntry";

/** Shown to someone who opened a room link but does not hold a seat yet. */
export function JoinPrompt({ code }: { code: string }) {
  const { name, setName, remember } = useDisplayName();
  const { pending, error, enter } = useRoomEntry<"join">();

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    remember(name.trim());
    void enter("join", () => joinRoom(code, name));
  };

  return (
    <>
      <Wordmark />
      <Card>
        <form onSubmit={onSubmit} className="space-y-4">
          <p className="text-sm text-muted">
            You have been invited to room <span className="font-mono tracking-widest text-brass">{code}</span>.
          </p>
          <TextField
            id="display-name"
            label="Your name"
            placeholder="Detective…"
            value={name}
            maxLength={24}
            autoComplete="nickname"
            autoFocus
            onChange={(e) => setName(e.target.value)}
          />
          <ErrorNote message={error} />
          <Button type="submit" className="w-full" disabled={name.trim().length < 2 || pending !== null}>
            {pending ? "Joining…" : "Take the second seat"}
          </Button>
        </form>
      </Card>
    </>
  );
}
