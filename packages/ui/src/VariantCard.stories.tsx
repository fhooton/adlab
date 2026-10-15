import type { Meta, StoryObj } from "@storybook/react-vite";
import { PosterFixture } from "./fixtures";
import { VariantCard } from "./VariantCard";

const meta = {
  title: "Components/VariantCard",
  component: VariantCard,
  args: {
    media: <PosterFixture hue={150} text="Dinner in 30." />,
    label: "control",
    sublabel: "Dinner in 30 minutes. Really.",
    status: "live",
    rating: 4.5,
    isControl: true,
    tags: ["Bold claim", "Motion graphic"],
    mediaBadge: "0:10",
    meta: "bold-claim-10s · 23c4240e",
  },
  decorators: [(S) => <div className="w-[190px]">{S()}</div>],
} satisfies Meta<typeof VariantCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Control: Story = {};
export const Winner: Story = {
  args: {
    media: <PosterFixture hue={30} text="Kids eat veg." />,
    label: "hook: Kids actually eat",
    status: "won",
    rating: 3,
    isControl: false,
    selected: true,
  },
};
export const Killed: Story = {
  args: {
    media: <PosterFixture hue={0} text="Skip it." />,
    label: "hook: Skip the grocery run.",
    status: "killed",
    rating: null,
    isControl: false,
  },
};
export const Rendering: Story = {
  args: {
    media: <div className="flex items-center justify-center text-xs text-ink-3">Rendering…</div>,
    label: "hook: Cook once.",
    status: "rendering",
    rating: null,
    isControl: false,
    tags: undefined,
  },
};
export const RenderFailed: Story = {
  args: {
    media: <div className="flex items-center justify-center text-xs text-failed">Render failed</div>,
    label: "hook: Takeout",
    status: "render_failed",
    rating: null,
    isControl: false,
    aspect: "1:1",
  },
};

export const Grid: Story = {
  decorators: [(S) => <div className="w-[900px]">{S()}</div>],
  render: () => (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(172px,1fr))] gap-3">
      <VariantCard
        media={<PosterFixture hue={150} text="Dinner in 30." />}
        label="control"
        status="live"
        rating={4.5}
        isControl
        tags={["Bold claim"]}
      />
      <VariantCard
        media={<PosterFixture hue={30} text="Kids eat veg." />}
        label="hook: Kids actually eat"
        status="won"
        rating={3}
      />
      <VariantCard
        media={<PosterFixture hue={0} text="Skip it." />}
        label="hook: Skip the grocery run."
        status="killed"
        rating={null}
      />
      <VariantCard
        media={<div className="flex items-center justify-center text-xs text-ink-3">Rendering…</div>}
        label="hook: Cook once."
        status="rendering"
        rating={null}
      />
    </div>
  ),
};
