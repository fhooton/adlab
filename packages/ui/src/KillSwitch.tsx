import { useState } from "react";
import { Button } from "./Button";
import { cx } from "./cx";
import { Dialog } from "./Dialog";
import { Field, TextArea } from "./Field";

export interface KillSwitchProps {
  engaged: boolean;
  /** Called with the typed reason (min 3 chars). */
  onEngage: (reason: string) => unknown;
  /** Present only for humans; agents cannot release. */
  onRelease?: () => unknown;
  busy?: boolean;
  /** Full-width block (sidebar) or inline button. */
  layout?: "block" | "inline";
  className?: string;
}

/** Danger control that pauses everything adlab launched. Requires a reason; engaged state is unmissable. */
export function KillSwitch({
  engaged,
  onEngage,
  onRelease,
  busy,
  layout = "block",
  className,
}: KillSwitchProps) {
  const [open, setOpen] = useState<"engage" | "release" | null>(null);
  const [reason, setReason] = useState("");
  const valid = reason.trim().length >= 3;

  const confirm = async () => {
    if (open === "engage") await onEngage(reason.trim());
    else if (open === "release") await onRelease?.();
    setOpen(null);
    setReason("");
  };

  return (
    <>
      {engaged ? (
        <div
          className={cx("flex flex-col gap-2 rounded-sm bg-danger px-3 py-2.5 text-danger-ink", className)}
          role="status"
        >
          <div className="flex items-center gap-2">
            <span className="size-2 animate-pulse rounded-full bg-white" aria-hidden="true" />
            <span className="text-sm font-semibold">Kill switch engaged</span>
          </div>
          <span className="text-xs opacity-90">Everything paused. New launches blocked.</span>
          {onRelease && (
            <button
              type="button"
              onClick={() => setOpen("release")}
              disabled={busy}
              className="h-6 self-start rounded-xs border border-white/40 px-2 text-xs font-medium hover:bg-white/10 disabled:opacity-50"
            >
              Release…
            </button>
          )}
        </div>
      ) : (
        <Button
          variant="secondary"
          size={layout === "block" ? "sm" : "xs"}
          onClick={() => setOpen("engage")}
          disabled={busy}
          className={cx(
            "border-danger/40 text-danger hover:bg-failed-bg",
            layout === "block" && "w-full justify-start",
            className,
          )}
          leading={<span className="size-1.5 rounded-full bg-danger" aria-hidden="true" />}
        >
          Kill switch
        </Button>
      )}

      <Dialog
        isOpen={open !== null}
        onOpenChange={(o) => !o && !busy && setOpen(null)}
        dismissable={!busy}
        tone={open === "engage" ? "danger" : "default"}
        title={open === "engage" ? "Pause everything adlab launched?" : "Release the kill switch?"}
        description={
          open === "engage"
            ? "Every active campaign, ad set and ad is paused on the platform now, and new launches are blocked until a human releases the switch."
            : "Launches are allowed again. Paused tests stay paused; nothing resumes automatically."
        }
        actions={
          <>
            <Button variant="ghost" onClick={() => setOpen(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant={open === "engage" ? "danger" : "primary"}
              onClick={confirm}
              disabled={open === "engage" && !valid}
              loading={busy}
            >
              {open === "engage" ? "Pause everything" : "Release"}
            </Button>
          </>
        }
      >
        {open === "engage" && (
          <Field
            label="Reason"
            hint="Recorded in the audit log and the alert."
            error={reason.length > 0 && !valid ? "At least 3 characters" : undefined}
          >
            {(id) => (
              <TextArea
                id={id}
                autoFocus
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Tracking pixel is down"
              />
            )}
          </Field>
        )}
      </Dialog>
    </>
  );
}
