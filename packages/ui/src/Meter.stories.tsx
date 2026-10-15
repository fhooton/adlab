import type { Meta, StoryObj } from "@storybook/react-vite";
import { Meter } from "./Meter";

const meta = {
  title: "Components/Meter",
  component: Meter,
  args: { value: 12000, committed: 24000, max: 50000, label: "Spend this week", valueLabel: "$120 of $500" },
  decorators: [(S) => <div className="max-w-md">{S()}</div>],
} satisfies Meta<typeof Meter>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Actual spend solid, committed (lifetime budgets) hatched, against the cap. */
export const UnderCap: Story = {};
export const NearCap: Story = {
  args: { value: 30000, committed: 42000, label: "Near cap (amber)", valueLabel: "84% committed" },
};
export const OverCap: Story = {
  args: { value: 52000, committed: undefined, label: "Over cap (red)", valueLabel: "104%" },
};
