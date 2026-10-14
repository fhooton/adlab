import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { useId } from "react";
import { cx } from "./cx";

const control =
  "rounded-sm border border-line-strong bg-surface px-2 text-base text-ink placeholder:text-ink-4 shadow-xs outline-none transition-colors focus:border-focus focus:ring-2 focus:ring-focus/15 disabled:opacity-60";

export interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: (id: string) => ReactNode;
  className?: string;
}

/** Label + control + hint/error. The child receives the generated id. */
export function Field({ label, hint, error, children, className }: FieldProps) {
  const id = useId();
  return (
    <div className={cx("flex flex-col gap-1", className)}>
      <label htmlFor={id} className="text-xs font-medium text-ink-2">
        {label}
      </label>
      {children(id)}
      {error ? (
        <p className="text-xs text-failed">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(control, "h-8 w-full", className)} {...rest} />;
}

export function TextArea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(control, "min-h-16 w-full resize-y py-1.5", className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(control, "h-7 pr-6 text-sm", className)} {...rest}>
      {children}
    </select>
  );
}

/** Native checkbox styled to the system. Supports the indeterminate state. */
export function Checkbox({
  indeterminate,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { indeterminate?: boolean }) {
  return (
    <input
      type="checkbox"
      ref={(el) => {
        if (el) el.indeterminate = Boolean(indeterminate);
      }}
      className={cx("size-3.5 shrink-0 cursor-pointer rounded-xs accent-[var(--color-ink)]", className)}
      {...rest}
    />
  );
}
