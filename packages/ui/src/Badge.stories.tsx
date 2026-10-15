import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge, StatusBadge } from "./Badge";
import { STATUSES, TONES } from "./fixtures";

const meta = {
  title: "Components/Badge",
  component: Badge,
  args: { children: "running", tone: "running", dot: true },
  argTypes: { tone: { control: "select", options: [...TONES] } },
} satisfies Meta<typeof Badge>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Tones: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {TONES.map((t) => (
        <Badge key={t} tone={t} dot>
          {t}
        </Badge>
      ))}
      <Badge outline>outline tag</Badge>
    </div>
  ),
};

/** StatusBadge maps any registry status string to a tone. */
export const Statuses: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {STATUSES.map((s) => (
        <StatusBadge key={s} status={s} />
      ))}
    </div>
  ),
};
