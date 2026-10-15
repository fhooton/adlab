import type { Meta, StoryObj } from "@storybook/react-vite";
import { TONES } from "./fixtures";

const meta = { title: "Foundations/Tokens", tags: ["!autodocs"] } satisfies Meta;
export default meta;

const NEUTRALS = [
  "canvas",
  "surface",
  "surface-2",
  "surface-3",
  "line",
  "line-strong",
  "ink",
  "ink-2",
  "ink-3",
  "ink-4",
  "accent",
  "focus",
  "link",
  "danger",
];

function Swatch({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="size-6 rounded-sm border border-line" style={{ background: `var(--color-${name})` }} />
      <span className="num text-xs text-ink-2">{name}</span>
    </div>
  );
}

/** Colour tokens from `tokens.css`. Status colours are defined once and reused everywhere. */
export const Colours: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {NEUTRALS.map((c) => (
          <Swatch key={c} name={c} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {TONES.map((t) => (
          <div key={t} className="flex flex-col gap-1.5">
            <Swatch name={t} />
            <Swatch name={`${t}-bg`} />
          </div>
        ))}
      </div>
    </div>
  ),
};

export const Type: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-3">
      <span className="text-2xl font-semibold">24 / Title</span>
      <span className="text-xl font-semibold">20 / Page</span>
      <span className="text-md font-semibold">14 / Panel</span>
      <span className="text-base">13 / Body</span>
      <span className="text-sm text-ink-2">12 / Secondary</span>
      <span className="text-xs text-ink-3">11 / Label</span>
      <span className="num text-base">1,234,567.89 tabular numerals</span>
    </div>
  ),
};
