import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, Spinner } from "./Button";

const meta = {
  title: "Components/Button",
  component: Button,
  args: { children: "Button", variant: "secondary" },
  argTypes: {
    variant: { control: "inline-radio", options: ["primary", "secondary", "ghost", "danger"] },
    size: { control: "inline-radio", options: ["xs", "sm", "md"] },
  },
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
export const Primary: Story = { args: { variant: "primary", children: "Approve launch" } };
export const Danger: Story = { args: { variant: "danger", children: "Engage kill switch" } };
export const Loading: Story = { args: { variant: "primary", loading: true, children: "Approving" } };
export const Disabled: Story = { args: { disabled: true } };

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="primary">Primary</Button>
      <Button>Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="danger">Danger</Button>
      <Button variant="primary" loading>
        Loading
      </Button>
      <Button disabled>Disabled</Button>
      <Button size="xs">Extra small</Button>
      <Button size="md" variant="primary">
        Medium
      </Button>
      <Spinner />
    </div>
  ),
};
