/**
 * Budget governor. Runs before ANY platform write that can spend money, in addition to platform
 * account limits. A test's lifetime budget is its worst-case spend, so committed spend is the sum
 * of lifetime budgets launched this week (or actual spend, if higher — e.g. after a manual edit).
 */
export interface LedgerLine {
  committedCents: number;
  actualCents: number;
}

export interface BudgetCheckInput {
  /** Hard account-wide weekly cap (ADLAB_WEEKLY_CAP_CENTS). */
  accountCapCents: number;
  /** The brief's weekly cap. */
  briefCapCents: number;
  /** Ledger lines for the current week across the whole account. */
  accountWeek: LedgerLine[];
  /** Ledger lines for the current week for this brief only. */
  briefWeek: LedgerLine[];
  /** The new commitment being requested (the test's lifetime budget). */
  requestedCents: number;
  killSwitchEngaged: boolean;
}

export interface BudgetCheck {
  allowed: boolean;
  reason: string;
  accountCommittedCents: number;
  briefCommittedCents: number;
  accountRemainingCents: number;
  briefRemainingCents: number;
}

export function committedOf(lines: LedgerLine[]): number {
  return lines.reduce((sum, l) => sum + Math.max(l.committedCents, l.actualCents), 0);
}

export function checkBudget(input: BudgetCheckInput): BudgetCheck {
  const accountCommittedCents = committedOf(input.accountWeek);
  const briefCommittedCents = committedOf(input.briefWeek);
  const accountRemainingCents = Math.max(0, input.accountCapCents - accountCommittedCents);
  const briefRemainingCents = Math.max(0, input.briefCapCents - briefCommittedCents);
  const base = { accountCommittedCents, briefCommittedCents, accountRemainingCents, briefRemainingCents };

  if (input.killSwitchEngaged) return { ...base, allowed: false, reason: "Kill switch is engaged" };
  if (!Number.isInteger(input.requestedCents) || input.requestedCents <= 0) {
    return { ...base, allowed: false, reason: "Requested budget must be a positive whole number of cents" };
  }
  if (input.requestedCents > accountRemainingCents) {
    return {
      ...base,
      allowed: false,
      reason: `Over account weekly cap: requested ${input.requestedCents}, remaining ${accountRemainingCents}`,
    };
  }
  if (input.requestedCents > briefRemainingCents) {
    return {
      ...base,
      allowed: false,
      reason: `Over brief weekly cap: requested ${input.requestedCents}, remaining ${briefRemainingCents}`,
    };
  }
  return { ...base, allowed: true, reason: "Within caps" };
}

/** Split a test budget evenly across ad sets (ABO), remainder to the first, never exceeding the total. */
export function splitBudget(totalCents: number, parts: number): number[] {
  if (parts <= 0) return [];
  const each = Math.floor(totalCents / parts);
  const out = Array.from({ length: parts }, () => each);
  out[0] = (out[0] ?? 0) + (totalCents - each * parts);
  return out;
}
