import type { Meta, StoryObj } from "@storybook/react-vite";
import { Money } from "./format";
import { MetricCard, MetricGrid } from "./MetricCard";

const meta = {
  title: "Components/MetricCard",
  component: MetricCard,
  args: {
    label: "Spend",
    value: "$79.26",
    delta: "+12%",
    deltaTone: "up",
    hint: "vs yesterday",
    sparkline: [2, 3, 3, 5, 4, 6, 8],
  },
} satisfies Meta<typeof MetricCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = { decorators: [(S) => <div className="w-60">{S()}</div>] };

export const Grid: Story = {
  render: () => (
    <MetricGrid columns={5}>
      <MetricCard
        label="Spend"
        value={<Money cents={7926} />}
        delta="+12%"
        deltaTone="up"
        hint="vs yesterday"
        sparkline={[2, 3, 3, 5, 4, 6, 8]}
      />
      <MetricCard label="Pending approvals" value="3" tone="pending" hint="Needs a human" />
      <MetricCard label="Winners" value="1" tone="won" />
      <MetricCard label="Failed renders" value="2" tone="failed" delta="+2" deltaTone="down" />
      <MetricCard
        label="Cost / winner"
        value={<Money cents={null} />}
        hint="No winners yet"
        onClick={() => {}}
      />
    </MetricGrid>
  ),
};
