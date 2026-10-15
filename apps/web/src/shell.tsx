import type { Overview } from "@adlab/contracts";
import { AppShell, KillSwitch, Sidebar, SidebarItem, SidebarSection } from "@adlab/ui";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router";
import * as api from "./api";
import { useAuth } from "./auth";
import { useAction } from "./feedback";
import { type PollState, usePoll } from "./hooks";

const OverviewContext = createContext<PollState<Overview> | null>(null);

/** Overview is polled once by the shell (pending count, kill switch) and shared with pages. */
export function useOverview(): PollState<Overview> {
  const ctx = useContext(OverviewContext);
  if (!ctx) throw new Error("useOverview outside the shell");
  return ctx;
}

const NAV: Array<{ to: string; label: string; match: RegExp }> = [
  { to: "/", label: "Overview", match: /^\/$/ },
  { to: "/approvals", label: "Approvals", match: /^\/approvals/ },
  { to: "/briefs", label: "Briefs", match: /^\/briefs/ },
  { to: "/variants", label: "Variants", match: /^\/variants/ },
  { to: "/tests", label: "Tests", match: /^\/tests/ },
  { to: "/learnings", label: "Learnings", match: /^\/learnings/ },
  { to: "/activity", label: "Activity", match: /^\/activity/ },
];

type Theme = "system" | "light" | "dark";
function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return (localStorage.getItem("adlab-theme") as Theme | null) ?? "system";
    } catch {
      return "system";
    }
  });
  useEffect(() => {
    const el = document.documentElement;
    if (theme === "system") el.removeAttribute("data-theme");
    else el.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("adlab-theme", theme);
    } catch {
      // storage unavailable (private mode); the choice just isn't remembered
    }
  }, [theme]);
  return [theme, setTheme];
}

function Wordmark() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <svg viewBox="0 0 16 16" className="size-[18px]" aria-hidden="true">
        <rect width="16" height="16" rx="3" fill="var(--color-ink)" />
        <path
          d="M4 11.5V7m4 4.5V4.5m4 7V8.5"
          stroke="var(--color-surface)"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
      <span className="text-md font-semibold tracking-[-0.01em]">adlab</span>
    </Link>
  );
}

export function Shell({ children }: { children?: ReactNode }) {
  const overview = usePoll(() => api.run("overview"), []);
  const { me, logout } = useAuth();
  const { pathname } = useLocation();
  const { busy, perform } = useAction();
  const [theme, setTheme] = useTheme();
  const engaged = overview.data?.killSwitchEngaged ?? false;
  const pending = overview.data?.counts.pendingApprovals ?? 0;

  const sidebar = (
    <Sidebar
      header={<Wordmark />}
      footer={
        <>
          <KillSwitch
            engaged={engaged}
            busy={busy !== null}
            onEngage={(reason) =>
              perform(
                "engage",
                () => api.call("killSwitchEngage", { reason }),
                (r) => ({
                  tone: "failed" as const,
                  title: `Kill switch engaged — paused ${r.paused} object(s)`,
                }),
              )
            }
            onRelease={
              me?.kind === "human"
                ? () =>
                    perform(
                      "release",
                      () => api.call("killSwitchRelease", {}),
                      "Kill switch released. Paused tests stay paused.",
                    )
                : undefined
            }
          />
          <div className="flex items-center justify-between gap-2 px-1 pt-1">
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium text-ink">{me?.name}</span>
              <span className="text-2xs text-ink-3">
                {me?.kind === "human" ? "Dashboard session" : me?.kind}
              </span>
            </div>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                className="rounded-xs px-1.5 py-1 text-xs text-ink-3 hover:bg-surface-3 hover:text-ink"
                onClick={() => setTheme(theme === "system" ? "dark" : theme === "dark" ? "light" : "system")}
                title="Theme: system → dark → light"
              >
                {theme === "system" ? "Auto" : theme === "dark" ? "Dark" : "Light"}
              </button>
              <button
                type="button"
                className="rounded-xs px-1.5 py-1 text-xs text-ink-3 hover:bg-surface-3 hover:text-ink"
                onClick={() => void logout()}
              >
                Log out
              </button>
            </div>
          </div>
        </>
      }
    >
      <SidebarSection>
        {NAV.map((n) => (
          <SidebarItem
            key={n.to}
            as={Link}
            to={n.to}
            label={n.label}
            active={n.match.test(pathname)}
            count={n.to === "/approvals" ? pending : undefined}
            countTone="pending"
          />
        ))}
      </SidebarSection>
    </Sidebar>
  );

  const banner = engaged ? (
    <div
      className="flex h-8 shrink-0 items-center gap-2 bg-danger px-8 text-sm font-medium text-danger-ink"
      role="alert"
    >
      <span className="size-1.5 rounded-full bg-white" aria-hidden="true" />
      Kill switch engaged — everything adlab launched is paused and new launches are blocked.
    </div>
  ) : undefined;

  return (
    <OverviewContext.Provider value={overview}>
      <AppShell sidebar={sidebar} banner={banner}>
        {children ?? <Outlet />}
      </AppShell>
    </OverviewContext.Provider>
  );
}
