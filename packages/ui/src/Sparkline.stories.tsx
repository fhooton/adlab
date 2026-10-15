import type { Meta, StoryObj } from "@storybook/react-vite";
import { Sparkline } from "./Sparkline";

const meta = {
  title: "Components/Sparkline",
  component: Sparkline,
  args: { values: [1, 4, 2, 6, 3, 7, 9, 5] },
} satisfies Meta<typeof Sparkline>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const SinglePoint: Story = { args: { values: [5] } };
export const LineOnly: Story = { args: { values: [3, 2, 4, 1], color: "var(--color-won)", area: false } };
