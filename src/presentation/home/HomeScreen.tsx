"use client";

import { useState, type FormEvent } from "react";
import { createRoom, joinRoom } from "@/presentation/api/roomsApi";
import { Button, Card, ErrorNote, TextField, Wordmark } from "@/presentation/components/ui";
import { useDisplayName } from "@/presentation/hooks/useDisplayName";
import { useRoomEntry } from "@/presentation/hooks/useRoomEntry";

const CODE_LENGTH = 6;

export function HomeScreen() {
  const { name, setName, remember } = useDisplayName();
  const [code, setCode] = useState("");
  const { pending, error, enter } = useRoomEntry<"create" | "join">();

  const hasName = name.trim().length >= 2;
  const busy = pending !== null;

  const onCreate = () => {
    remember(name.trim());
    void enter("create", () => createRoom(name));
  };

  const onJoin = (event: FormEvent) => {
    event.preventDefault();
    remember(name.trim());
    void enter("join", () => joinRoom(code, name));
  };

  return (
    <>
      <Wordmark />
      <Card className="space-y-6">
        <TextField
          id="display-name"
          label="Your name"
          placeholder="Detective…"
          value={name}
          maxLength={24}
          autoComplete="nickname"
          onChange={(e) => setName(e.target.value)}
        />

        <ErrorNote message={error} />

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col justify-between gap-3">
            <p className="text-sm text-muted">Open a new room and send the code to your partner.</p>
            <Button onClick={onCreate} disabled={!hasName || busy}>
              {pending === "create" ? "Opening…" : "Open a room"}
            </Button>
          </div>

          <form onSubmit={onJoin} className="flex flex-col gap-3 sm:border-l sm:border-ink-700 sm:pl-6">
            <TextField
              id="room-code"
              label="Room code"
              placeholder="ABC234"
              value={code}
              maxLength={CODE_LENGTH}
              autoComplete="off"
              spellCheck={false}
              className="font-mono uppercase tracking-[0.3em]"
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
            />
            <Button type="submit" variant="ghost" disabled={!hasName || code.length !== CODE_LENGTH || busy}>
              {pending === "join" ? "Joining…" : "Join room"}
            </Button>
          </form>
        </div>
      </Card>
    </>
  );
}
