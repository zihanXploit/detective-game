"use client";

import { useState, type FormEvent } from "react";
import type { GameActionPayload, PuzzleItemView } from "@/shared/realtime/contract";

type Act = (action: GameActionPayload) => Promise<string | null>;

const ANSWER_MAX_LENGTH = 200;

function LockedNote({ blockedBy, partnerRoleName }: { blockedBy: NonNullable<PuzzleItemView["blockedBy"]>; partnerRoleName: string }) {
  const parts: string[] = [];
  if (blockedBy.yours.length > 0) parts.push(`You have not looked at ${blockedBy.yours.join(" or ")} yet.`);
  if (blockedBy.partnerItems > 0) {
    const count = blockedBy.partnerItems;
    parts.push(`${partnerRoleName} has ${count} thing${count === 1 ? "" : "s"} still to look at.`);
  }
  return <p className="mt-2 text-sm text-muted">{parts.join(" ")}</p>;
}

function Hints({ puzzle, disabled, act }: { puzzle: PuzzleItemView; disabled: boolean; act: Act }) {
  return (
    <div className="mt-3">
      {puzzle.hints.length > 0 && (
        <ul className="mb-2 space-y-1">
          {puzzle.hints.map((hint, index) => (
            <li key={index} className="text-sm text-muted">
              Hint {index + 1}: {hint}
            </li>
          ))}
        </ul>
      )}
      {puzzle.hintsRemaining > 0 && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => void act({ type: "REVEAL_HINT", puzzleId: puzzle.id })}
          className="text-xs font-medium text-muted underline underline-offset-2 transition-colors
            hover:text-paper disabled:cursor-not-allowed disabled:opacity-50
            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
        >
          Give me a hint ({puzzle.hintsRemaining} left)
        </button>
      )}
    </div>
  );
}

function PuzzleCard({ puzzle, partnerRoleName, disabled, act }: {
  puzzle: PuzzleItemView;
  partnerRoleName: string;
  disabled: boolean;
  act: Act;
}) {
  const [answer, setAnswer] = useState("");
  const [rejected, setRejected] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const error = await act({ type: "SUBMIT_ANSWER", puzzleId: puzzle.id, answer });
    setBusy(false);
    // The server accepted the guess; if it had been right this card would now be solved.
    if (!error) setRejected(true);
  };

  return (
    <li
      className={`rounded-lg border p-4 ${
        puzzle.solved ? "border-signal/40 bg-signal/5" : "border-ink-700 bg-ink-800"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="font-display text-lg">{puzzle.name}</h4>
        {puzzle.solved ? (
          <span className="shrink-0 text-xs text-signal">Answered</span>
        ) : (
          !puzzle.unlocked && <span className="shrink-0 text-xs text-muted">Not yet</span>
        )}
      </div>
      <p className="mt-1 text-sm text-muted">{puzzle.prompt}</p>

      {puzzle.solved && puzzle.solvedNote && <p className="mt-2 text-sm text-signal">{puzzle.solvedNote}</p>}

      {!puzzle.solved && puzzle.blockedBy && (
        <LockedNote blockedBy={puzzle.blockedBy} partnerRoleName={partnerRoleName} />
      )}

      {!puzzle.solved && puzzle.unlocked && (
        <>
          <form onSubmit={submit} className="mt-3 flex flex-wrap gap-2">
            <input
              value={answer}
              maxLength={ANSWER_MAX_LENGTH}
              disabled={disabled || busy}
              aria-label={`Answer for ${puzzle.name}`}
              onChange={(e) => {
                setAnswer(e.target.value);
                setRejected(false);
              }}
              placeholder="Your answer"
              className="min-w-0 flex-1 rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-paper
                placeholder:text-muted/60 focus:border-brass focus:outline-none disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={disabled || busy || answer.trim().length === 0}
              className="rounded-lg bg-brass px-4 py-2 text-sm font-semibold text-ink-950 transition-colors
                hover:bg-brass-deep disabled:cursor-not-allowed disabled:opacity-50
                focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
            >
              Answer
            </button>
          </form>
          {rejected && (
            <p role="status" className="mt-2 text-sm text-alert">
              That is not it. Compare what you each have again.
            </p>
          )}
          <Hints puzzle={puzzle} disabled={disabled || busy} act={act} />
        </>
      )}

      {puzzle.attempts > 0 && (
        <p className="mt-2 text-xs text-muted">
          {puzzle.attempts} attempt{puzzle.attempts === 1 ? "" : "s"} between you.
        </p>
      )}
    </li>
  );
}

export function PuzzlePanel({ puzzles, partnerRoleName, disabled, act }: {
  puzzles: PuzzleItemView[];
  partnerRoleName: string;
  disabled: boolean;
  act: Act;
}) {
  if (puzzles.length === 0) return null;

  const solved = puzzles.filter((p) => p.solved).length;

  return (
    <section aria-labelledby="puzzles-heading" className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="puzzles-heading" className="text-xs font-medium uppercase tracking-wider text-muted">
          Questions to settle
        </h3>
        <span className="text-xs text-muted">
          {solved} of {puzzles.length} answered
        </span>
      </div>
      <ul className="space-y-2">
        {puzzles.map((puzzle) => (
          <PuzzleCard
            key={puzzle.id}
            puzzle={puzzle}
            partnerRoleName={partnerRoleName}
            disabled={disabled}
            act={act}
          />
        ))}
      </ul>
    </section>
  );
}
