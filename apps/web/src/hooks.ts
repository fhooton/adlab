import { type DependencyList, useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "./api";

export const POLL_MS = 5000;

// A tiny invalidation bus: after any write, every mounted poll refetches immediately.
const subscribers = new Set<() => void>();
export function invalidateAll() {
  for (const fn of subscribers) fn();
}

export interface PollState<T> {
  data: T | undefined;
  error: ApiError | undefined;
  loading: boolean;
  /** Last successful fetch. */
  updatedAt: Date | null;
  refresh: () => void;
}

/**
 * Fetch now, then every 5s while the tab is visible, so agents' work shows up without a reload.
 * Changing `deps` resets the data (a different entity is being shown).
 */
export function usePoll<T>(
  fetcher: () => Promise<T>,
  deps: DependencyList,
  opts: { interval?: number; enabled?: boolean } = {},
): PollState<T> {
  const { interval = POLL_MS, enabled = true } = opts;
  const [data, setData] = useState<T>();
  const [error, setError] = useState<ApiError>();
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const result = await fetcherRef.current();
      if (mine !== seq.current) return;
      setData(result);
      setError(undefined);
      setUpdatedAt(new Date());
    } catch (err) {
      if (mine !== seq.current) return;
      setError(err instanceof ApiError ? err : new ApiError(0, "error", (err as Error).message));
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    setData(undefined);
    setLoading(true);
    void load();
    const tick = () => {
      if (document.visibilityState === "visible") void load();
    };
    const timer = window.setInterval(tick, interval);
    const onVisible = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onVisible);
    subscribers.add(tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      subscribers.delete(tick);
      seq.current++;
    };
  }, [...deps, enabled, interval, load]);

  return { data, error, loading, updatedAt, refresh: () => void load() };
}

/** Re-render periodically so relative times ("3m ago") stay fresh. */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}
