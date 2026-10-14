import { type ReactNode, useState } from "react";
import { StatusBadge } from "./Badge";
import { Button } from "./Button";
import { cx } from "./cx";
import { TextArea } from "./Field";
import { formatDateTime, formatRelative, Money } from "./format";

export interface ApprovalPanelProps {
  title: ReactNode;
  /** What kind of approval this is, e.g. "Launch test". */
  kindLabel: ReactNode;
  status: string;
  requester: string;
  requestedAt: string;
  /** Money at stake in cents, if any. Shown large. */
  amountCents?: number | null;
  /** Free text; lines starting with "•" render as a list. */
  summary: string;
  /** Extra content between summary and actions (e.g. hypothesis checkboxes). */
  children?: ReactNode;
  /** Small key/value rows under the header (test id, decision count...). */
  details?: Array<[ReactNode, ReactNode]>;
  onApprove?: (note: string) => void;
  onDecline?: (note: string) => void;
  /** Which action is in flight; disables both buttons. */
  submitting?: "approve" | "decline" | null;
  approveDisabled?: boolean;
  /** Shown next to the disabled approve button. */
  approveHint?: ReactNode;
  approveLabel?: ReactNode;
  /** For decided approvals: who, when and the result message. */
  decision?: { by: string | null; at: string | null; result: string | null };
  onClose?: () => void;
  className?: string;
}

function Summary({ text }: { text: string }) {
  const lines = text.split("\n").filter((l) => l.trim());
  const bullets = lines.filter((l) => l.trim().startsWith("•"));
  const prose = lines.filter((l) => !l.trim().startsWith("•"));
  return (
    <div className="flex flex-col gap-2 text-sm text-ink-2">
      {prose.map((p) => (
        <p key={p}>{p}</p>
      ))}
      {bullets.length > 0 && (
        <ul className="flex flex-col divide-y divide-line rounded-sm border border-line">
          {bullets.map((b) => (
            <li key={b} className="px-2.5 py-1.5 text-ink">
              {b.replace(/^\s*•\s*/, "")}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Side panel for one approval (render with `key={approval.id}` so the note resets): what, who asked, how much, then approve/decline with an optional note. */
export function ApprovalPanel({
  title,
  kindLabel,
  status,
  requester,
  requestedAt,
  amountCents,
  summary,
  children,
  details = [],
  onApprove,
  onDecline,
  submitting = null,
  approveDisabled,
  approveHint,
  approveLabel = "Approve",
  decision,
  onClose,
  className,
}: ApprovalPanelProps) {
  const [note, setNote] = useState("");
  const pending = status === "pending";
  const busy = submitting !== null;

  return (
    <aside
      className={cx(
        "flex min-h-0 flex-col overflow-hidden rounded-md border border-line bg-surface",
        className,
      )}
      aria-label="Approval"
    >
      <header className="flex flex-col gap-2 border-b border-line px-4 pt-3.5 pb-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-3">{kindLabel}</span>
          <div className="flex items-center gap-2">
            <StatusBadge status={status} />
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-xs p-0.5 text-ink-3 hover:bg-surface-3 hover:text-ink"
              >
                <svg viewBox="0 0 12 12" className="size-3" aria-hidden="true">
                  <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.4" />
                </svg>
              </button>
            )}
          </div>
        </div>
        <h2 className="text-md font-semibold text-ink">{title}</h2>
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs text-ink-3">
          <span>
            Requested by <span className="font-medium text-ink-2">{requester}</span>
          </span>
          <span title={formatDateTime(requestedAt)}>{formatRelative(requestedAt)}</span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-3.5">
        {amountCents !== null && amountCents !== undefined && (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-ink-3">Amount at stake (lifetime budget)</span>
            <Money cents={amountCents} className="text-2xl font-medium text-ink" />
          </div>
        )}
        {details.length > 0 && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            {details.map(([k, v], i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static detail rows
              <div key={i} className="contents">
                <dt className="text-ink-3">{k}</dt>
                <dd className="min-w-0 truncate text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        )}
        <Summary text={summary} />
        {children}
        {!pending && decision && (
          <div className="flex flex-col gap-1 rounded-sm border border-line bg-surface-2 px-3 py-2 text-sm">
            <span className="text-ink-2">
              {status === "approved"
                ? "Approved"
                : status === "declined"
                  ? "Declined"
                  : status === "failed"
                    ? "Failed"
                    : "Decided"}{" "}
              by <span className="font-medium text-ink">{decision.by ?? "—"}</span>
              {decision.at && <span className="text-ink-3"> · {formatDateTime(decision.at)}</span>}
            </span>
            {decision.result && (
              <span className={cx(status === "failed" ? "text-failed" : "text-ink-2")}>
                {decision.result}
              </span>
            )}
          </div>
        )}
      </div>

      {pending && (onApprove || onDecline) && (
        <footer className="flex flex-col gap-2 border-t border-line bg-surface-2 px-4 py-3">
          <TextArea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional) — recorded in the audit log"
            maxLength={500}
            rows={2}
            disabled={busy}
            className="min-h-0 text-sm"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-xs text-ink-3">
              {approveDisabled ? approveHint : null}
            </span>
            <div className="flex gap-2">
              {onDecline && (
                <Button
                  variant="secondary"
                  onClick={() => onDecline(note)}
                  disabled={busy}
                  loading={submitting === "decline"}
                >
                  Decline
                </Button>
              )}
              {onApprove && (
                <Button
                  variant="primary"
                  onClick={() => onApprove(note)}
                  disabled={busy || approveDisabled}
                  loading={submitting === "approve"}
                >
                  {approveLabel}
                </Button>
              )}
            </div>
          </div>
        </footer>
      )}
    </aside>
  );
}
