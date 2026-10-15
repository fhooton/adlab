import type { Meta, StoryObj } from "@storybook/react-vite";
import { ConfidenceBar } from "./ConfidenceBar";

const scale = { min: 0.15, max: 0.35 };

const meta = {
  title: "Components/ConfidenceBar",
  component: ConfidenceBar,
  args: {
    interval: { low: 0.276, mean: 0.291, high: 0.306 },
    scale,
    enoughEvidence: true,
    tone: "won",
    reference: 0.256,
  },
  decorators: [(S) => <div className="max-w-sm rounded-md border border-line bg-surface p-3">{S()}</div>],
} satisfies Meta<typeof ConfidenceBar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Winner: Story = {};
export const NeedMoreData: Story = {
  args: {
    interval: { low: 0.18, mean: 0.26, high: 0.33 },
    enoughEvidence: false,
    tone: undefined,
    reference: undefined,
  },
};
export const NoData: Story = {
  args: { interval: null, enoughEvidence: false, tone: undefined, reference: undefined },
};

/** Rows share one scale so intervals are comparable down a results table. */
export const SharedScale: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <ConfidenceBar
        interval={{ low: 0.24, mean: 0.256, high: 0.272 }}
        scale={scale}
        enoughEvidence
        tone="control"
      />
      <ConfidenceBar
        interval={{ low: 0.276, mean: 0.291, high: 0.306 }}
        scale={scale}
        enoughEvidence
        tone="won"
        reference={0.256}
      />
      <ConfidenceBar
        interval={{ low: 0.19, mean: 0.205, high: 0.221 }}
        scale={scale}
        enoughEvidence
        tone="killed"
        reference={0.256}
      />
      <ConfidenceBar interval={{ low: 0.18, mean: 0.26, high: 0.33 }} scale={scale} enoughEvidence={false} />
      <ConfidenceBar interval={null} scale={scale} enoughEvidence={false} />
    </div>
  ),
};
