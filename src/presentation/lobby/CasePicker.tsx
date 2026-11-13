import type { CaseSummaryView } from "@/shared/realtime/contract";

interface CasePickerProps {
  cases: readonly CaseSummaryView[];
  selectedSlug: string | null;
  /** Only the host may change the case; everyone else sees the choice. */
  canChoose: boolean;
  disabled: boolean;
  onSelect: (slug: string) => void;
}

export function CasePicker({ cases, selectedSlug, canChoose, disabled, onSelect }: CasePickerProps) {
  const visible = canChoose ? cases : cases.filter((c) => c.slug === selectedSlug);

  return (
    <section aria-labelledby="case-heading">
      <h2 id="case-heading" className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">
        Case
      </h2>

      {visible.length === 0 && (
        <p className="rounded-lg border border-dashed border-ink-700 p-4 text-sm text-muted">
          {canChoose ? "No cases are available." : "The host has not chosen a case yet."}
        </p>
      )}

      <ul className="space-y-2">
        {visible.map((item) => {
          const selected = item.slug === selectedSlug;
          const body = (
            <>
              <span className="flex items-baseline justify-between gap-3">
                <span className="font-display text-lg">{item.title}</span>
                <span className="shrink-0 text-xs text-muted">about {item.estimatedMinutes} min</span>
              </span>
              <span className="mt-1 block text-sm text-muted">{item.synopsis}</span>
              {selected && (
                <span className="mt-2 block text-xs text-muted">
                  {item.roleNames.A}: {item.roleSummaries.A} · {item.roleNames.B}: {item.roleSummaries.B}
                </span>
              )}
            </>
          );
          const frame = `block w-full rounded-lg border p-4 text-left ${
            selected ? "border-brass bg-brass/10" : "border-ink-700 bg-ink-800"
          }`;

          return (
            <li key={item.slug}>
              {canChoose ? (
                <button
                  type="button"
                  aria-pressed={selected}
                  disabled={disabled}
                  onClick={() => onSelect(item.slug)}
                  className={`${frame} transition-colors hover:border-brass/70 disabled:cursor-not-allowed disabled:opacity-60
                    focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass`}
                >
                  {body}
                </button>
              ) : (
                <div className={frame}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
