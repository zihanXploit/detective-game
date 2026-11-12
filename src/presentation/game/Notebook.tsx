"use client";

import { useEffect, useRef, useState } from "react";

const MAX_LENGTH = 4000;
const SAVE_DELAY_MS = 700;

type SaveState = "saved" | "pending" | "failed";

interface NotebookProps {
  /** The text the server holds. Only used until the player starts typing. */
  saved: string;
  disabled: boolean;
  onSave: (text: string) => Promise<string | null>;
}

/** A private scratchpad. Saves shortly after the player stops typing. */
export function Notebook({ saved, disabled, onSave }: NotebookProps) {
  // Once the player types, their draft owns the field: a late echo of an older
  // save from the server must not overwrite what they are in the middle of writing.
  const [draft, setDraft] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const onChange = (text: string) => {
    setDraft(text);
    setSaveState("pending");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const error = await onSave(text);
      setSaveState(error ? "failed" : "saved");
    }, SAVE_DELAY_MS);
  };

  const status = { saved: "Saved", pending: "Saving…", failed: "Not saved" }[saveState];

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <label htmlFor="notebook" className="text-xs font-medium uppercase tracking-wider text-muted">
          Your notebook
        </label>
        <span className={`text-xs ${saveState === "failed" ? "text-alert" : "text-muted"}`} aria-live="polite">
          {status}
        </span>
      </div>
      <textarea
        id="notebook"
        rows={5}
        maxLength={MAX_LENGTH}
        disabled={disabled}
        value={draft ?? saved}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Only you can see what you write here."
        className="w-full resize-y rounded-lg border border-ink-700 bg-ink-950 px-3 py-2.5 text-sm text-paper
          placeholder:text-muted/60 focus:border-brass focus:outline-none disabled:opacity-60"
      />
    </div>
  );
}
