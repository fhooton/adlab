import { Notice, type Tone } from "@adlab/ui";
import { createContext, type ReactNode, useCallback, useContext, useMemo, useRef, useState } from "react";
import { ApiError } from "./api";
import { invalidateAll } from "./hooks";

interface Toast {
  id: number;
  tone: Tone;
  title: ReactNode;
  body?: ReactNode;
}
type Push = (t: Omit<Toast, "id">) => void;

const ToastContext = createContext<Push>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);
  const push = useCallback<Push>((t) => {
    const id = next.current++;
    setToasts((xs) => [...xs.slice(-3), { ...t, id }]);
    window.setTimeout(
      () => setToasts((xs) => xs.filter((x) => x.id !== id)),
      t.tone === "failed" ? 8000 : 5000,
    );
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[360px] flex-col gap-2"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <Notice
            key={t.id}
            tone={t.tone}
            title={t.title}
            className="pointer-events-auto bg-surface shadow-pop"
            role={t.tone === "failed" ? "alert" : "status"}
          >
            {t.body}
          </Notice>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

/**
 * Wrap a write: tracks which action is in flight, toasts the outcome, and refetches every poll.
 * 409 means someone (or a rule) acted first: say so and refresh instead of failing loudly.
 */
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const perform = useCallback(
    async <T,>(
      id: string,
      fn: () => Promise<{ status: number; body: T }>,
      success?: string | ((body: T) => string | { tone: Tone; title: string }),
    ): Promise<T | undefined> => {
      setBusy(id);
      try {
        const res = await fn();
        if (res.status === 202)
          toast({
            tone: "pending",
            title: "Waiting for approval",
            body: "A human needs to approve this in Approvals.",
          });
        else if (success) {
          const msg = typeof success === "function" ? success(res.body) : success;
          toast(typeof msg === "string" ? { tone: "won", title: msg } : msg);
        }
        return res.body;
      } catch (err) {
        if (err instanceof ApiError && err.isConflict) {
          toast({ tone: "pending", title: "Changed since you loaded it — refreshing", body: err.message });
        } else {
          toast({
            tone: "failed",
            title: err instanceof ApiError ? err.message : "Something went wrong",
            body: err instanceof ApiError && err.code !== "error" ? `Error: ${err.code}` : undefined,
          });
        }
        return undefined;
      } finally {
        setBusy(null);
        invalidateAll();
      }
    },
    [toast],
  );

  return useMemo(() => ({ busy, perform }), [busy, perform]);
}
