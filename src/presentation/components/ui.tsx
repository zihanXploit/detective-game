import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(" ");

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-xl border border-ink-700 bg-ink-900/80 p-6 shadow-xl", className)}>
      {children}
    </section>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" };

export function Button({ variant = "primary", className, type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        "rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-brass text-ink-950 hover:bg-brass-deep",
        variant === "ghost" && "border border-ink-700 text-paper hover:bg-ink-800",
        className,
      )}
      {...rest}
    />
  );
}

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string };

export function TextField({ label, id, className, ...rest }: TextFieldProps) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">{label}</span>
      <input
        id={id}
        className={cx(
          "w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2.5 text-paper",
          "placeholder:text-muted/60 focus:border-brass focus:outline-none",
          className,
        )}
        {...rest}
      />
    </label>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg border border-alert/40 bg-alert/10 px-3 py-2 text-sm text-alert">
      {message}
    </p>
  );
}

export function Wordmark() {
  return (
    <header className="mb-8 text-center">
      <h1 className="font-display text-4xl tracking-tight text-paper">
        Two <span className="text-brass">Lanterns</span>
      </h1>
      <p className="mt-2 text-sm text-muted">A detective game for two. Each of you holds half the truth.</p>
    </header>
  );
}
