import type { Meta, StoryObj } from "@storybook/react-vite";
import { Money, Percent, Stat } from "./format";

const meta = { title: "Components/Formatters" } satisfies Meta;
export default meta;

/** Money is always integer cents; null renders an em dash. */
export const All: StoryObj = {
  render: () => (
    <div className="flex flex-wrap gap-8">
      <Stat label="Money">
        <Money cents={2400050} />
      </Stat>
      <Stat label="Money (whole)">
        <Money cents={2400050} whole />
      </Stat>
      <Stat label="Money (null)">
        <Money cents={null} />
      </Stat>
      <Stat label="Percent">
        <Percent value={0.2913} />
      </Stat>
      <Stat label="Percent (null)">
        <Percent value={null} />
      </Stat>
      <Stat inline label="Inline stat">
        <Money cents={24000} />
      </Stat>
    </div>
  ),
};
