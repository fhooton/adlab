import { Button, Field, Input, Notice } from "@adlab/ui";
import { type FormEvent, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { ApiError } from "../api";
import { useAuth } from "../auth";

function rememberedName() {
  try {
    return localStorage.getItem("adlab-name") ?? "";
  } catch {
    return "";
  }
}

export function LoginView() {
  const { me, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";
  const [name, setName] = useState(rememberedName);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (me) return <Navigate to={from} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(name.trim(), password);
      try {
        localStorage.setItem("adlab-name", name.trim());
      } catch {
        // not remembered; fine
      }
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-start justify-center bg-canvas px-4 pt-[18vh]">
      <form onSubmit={submit} className="flex w-full max-w-[340px] flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 16 16" className="size-5" aria-hidden="true">
              <rect width="16" height="16" rx="3" fill="var(--color-ink)" />
              <path
                d="M4 11.5V7m4 4.5V4.5m4 7V8.5"
                stroke="var(--color-surface)"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
            <span className="text-lg font-semibold tracking-[-0.01em]">adlab</span>
          </div>
          <p className="text-sm text-ink-2">Approve spend, review results, and stop everything if needed.</p>
        </div>
        <div className="flex flex-col gap-3 rounded-md border border-line bg-surface p-4">
          <Field
            label="Display name"
            hint="Shown in the audit log next to everything you approve. Not an account."
          >
            {(id) => (
              <Input
                id={id}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={40}
                autoComplete="nickname"
                autoFocus={!name}
              />
            )}
          </Field>
          <Field label="Dashboard password" hint="The shared password from ADLAB_DASHBOARD_PASSWORD.">
            {(id) => (
              <Input
                id={id}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                autoFocus={Boolean(name)}
              />
            )}
          </Field>
          {error && <Notice tone="failed">{error}</Notice>}
          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={busy}
            disabled={!name.trim() || !password}
          >
            Sign in
          </Button>
        </div>
      </form>
    </div>
  );
}
