import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Rating } from "./Rating";

const meta = { title: "Components/Rating", component: Rating, args: { value: 3.6 } } satisfies Meta<
  typeof Rating
>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ReadOnly: Story = {};
export const Unrated: Story = { args: { value: null } };
export const Disabled: Story = { args: { value: null, onChange: () => {}, size: "md", disabled: true } };

/** Human taste capture: 1–5, becomes eval data for the generators. */
export const Interactive: Story = {
  render: () => {
    const [value, setValue] = useState<number | null>(3);
    return <Rating value={value} onChange={setValue} size="md" />;
  },
};
