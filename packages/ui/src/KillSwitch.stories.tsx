import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { KillSwitch } from "./KillSwitch";

const meta = {
  title: "Components/KillSwitch",
  component: KillSwitch,
  args: { engaged: false, onEngage: () => {} },
  decorators: [(S) => <div className="w-[216px]">{S()}</div>],
} satisfies Meta<typeof KillSwitch>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Engaging asks for a reason in a confirm dialog. */
export const Interactive: Story = {
  render: () => {
    const [engaged, setEngaged] = useState(false);
    return (
      <KillSwitch engaged={engaged} onEngage={() => setEngaged(true)} onRelease={() => setEngaged(false)} />
    );
  },
};

/** As an agent sees it: no release (only a dashboard session can release). */
export const EngagedNoRelease: Story = { args: { engaged: true } };
export const EngagedWithRelease: Story = { args: { engaged: true, onRelease: () => {} } };
