import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { ApprovalPanel } from "./ApprovalPanel";
import { Checkbox } from "./Field";
import { minutesAgo } from "./fixtures";

const meta = {
  title: "Components/ApprovalPanel",
  component: ApprovalPanel,
  args: {
    title: "Launch stage 1 test: 6 variants for Sprout",
    kindLabel: "Launch test",
    status: "pending",
    requester: "claude-agent",
    requestedAt: minutesAgo(12),
    amountCents: 24000,
    summary:
      "ABO: 1 campaign, 1 ad set per variant. Lifetime budget $240.00 over 72h. After approval: brief week committed $240.00 of $400.00.",
    details: [["Test", "tst_gyuy5j6zsz6h"]],
    approveLabel: "Approve launch",
    onApprove: () => {},
    onDecline: () => {},
  },
  decorators: [(S) => <div className="max-w-md">{S()}</div>],
} satisfies Meta<typeof ApprovalPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const LaunchPending: Story = {};
export const Submitting: Story = { args: { submitting: "approve" } };

export const Decided: Story = {
  args: {
    title: "3 decision(s) on stage 1 test",
    kindLabel: "Apply decisions",
    status: "approved",
    requester: "rules:stage1-v1",
    requestedAt: minutesAgo(26 * 60),
    amountCents: undefined,
    details: undefined,
    summary:
      "• KILL hook: Skip the grocery run.: hook rate below control\n• PROMOTE hook: Kids actually eat: P(best) 91%",
    decision: { by: "Forrest", at: new Date().toISOString(), result: "Applied 3 decision(s) — looks right" },
  },
};

/** select_hypotheses approvals need a selection before Approve enables. */
export const PickHypotheses: Story = {
  render: (args) => {
    const [picked, setPicked] = useState<string[]>(["h1"]);
    const options = [
      ["h1", "time-saved × busy-parent × motion_graphic"],
      ["h2", "picky-eaters × busy-parent × motion_graphic"],
    ] as const;
    return (
      <ApprovalPanel
        {...args}
        title="Pick angles to test for Sprout"
        kindLabel="Select hypotheses"
        amountCents={undefined}
        details={undefined}
        summary=""
        approveDisabled={picked.length === 0}
        approveHint="Pick at least one hypothesis to test"
        approveLabel={`Approve ${picked.length} selected`}
      >
        <ul className="flex flex-col divide-y divide-line rounded-sm border border-line">
          {options.map(([id, label]) => (
            <li key={id}>
              <label
                htmlFor={`sb-${id}`}
                className="flex cursor-pointer items-center gap-2.5 px-2.5 py-2 text-sm"
              >
                <Checkbox
                  id={`sb-${id}`}
                  checked={picked.includes(id)}
                  onChange={() => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))}
                />
                {label}
              </label>
            </li>
          ))}
        </ul>
      </ApprovalPanel>
    );
  },
};
