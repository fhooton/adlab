/** Fixture data and helpers shared by the stories (not exported from the package). */
export const TONES = ["running", "pending", "killed", "won", "failed", "nmd", "neutral"] as const;

export const STATUSES = [
  "running",
  "pending_approval",
  "paused",
  "killed",
  "won",
  "approved",
  "failed",
  "render_failed",
  "draft",
  "ended",
  "need_more_data",
];

export interface FixtureRow {
  id: string;
  label: string;
  impressions: number;
  spendCents: number;
  hookRate: number | null;
  status: string;
}

export const ROWS: FixtureRow[] = [
  { id: "a", label: "control", impressions: 12840, spendCents: 4012, hookRate: 0.256, status: "live" },
  {
    id: "b",
    label: "hook: Kids actually eat the veggies",
    impressions: 13102,
    spendCents: 4100,
    hookRate: 0.291,
    status: "won",
  },
  {
    id: "c",
    label: "hook: Skip the grocery run.",
    impressions: 11977,
    spendCents: 3875,
    hookRate: 0.205,
    status: "killed",
  },
  {
    id: "d",
    label: "hook: Takeout is costing you.",
    impressions: 0,
    spendCents: 0,
    hookRate: null,
    status: "draft",
  },
];

export function PosterFixture({ hue, text }: { hue: number; text: string }) {
  return (
    <svg viewBox="0 0 90 160" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="90" height="160" fill={`hsl(${hue} 30% 22%)`} />
      <text x="8" y="70" fill="white" fontSize="11" fontFamily="Inter Variable, sans-serif" fontWeight="700">
        {text}
      </text>
      <rect x="8" y="132" width="50" height="12" rx="2" fill="white" opacity="0.9" />
    </svg>
  );
}

export const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
