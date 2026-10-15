import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./Button";
import { EmptyState } from "./EmptyState";
import { Checkbox, Field, Input, Select, TextArea } from "./Field";
import { formatMoney, formatPercent } from "./format";
import { KeyValue, Panel } from "./Layout";
import { Notice } from "./Notice";

const meta = { title: "Components/Forms, Notice & Panel" } satisfies Meta;
export default meta;

export const Fields: StoryObj = {
  render: () => (
    <div className="flex max-w-md flex-col gap-3">
      <Field label="Display name" hint="Shown in the audit log.">
        {(id) => <Input id={id} placeholder="Forrest" />}
      </Field>
      <Field label="Reason" error="At least 3 characters">
        {(id) => <TextArea id={id} defaultValue="no" />}
      </Field>
      <div className="flex items-center gap-3">
        <Select defaultValue="b" aria-label="Brief">
          <option value="a">All briefs</option>
          <option value="b">Sprout</option>
        </Select>
        <label htmlFor="sb-checked" className="flex items-center gap-1.5 text-sm">
          <Checkbox id="sb-checked" defaultChecked /> Checked
        </label>
        <label htmlFor="sb-indeterminate" className="flex items-center gap-1.5 text-sm">
          <Checkbox id="sb-indeterminate" indeterminate /> Indeterminate
        </label>
      </div>
    </div>
  ),
};

export const Notices: StoryObj = {
  render: () => (
    <div className="flex max-w-md flex-col gap-2">
      <Notice tone="pending" title="Changed since you loaded it — refreshing">
        Someone else approved this first.
      </Notice>
      <Notice tone="failed" title="Launch blocked">
        Weekly cap would be exceeded by {formatMoney(4000)}.
      </Notice>
      <Notice tone="won" title="Applied 3 decisions" />
      <Notice tone="nmd" title="Need more data">
        {formatPercent(0.42, 0)} of the minimum impressions so far.
      </Notice>
    </div>
  ),
};

export const Panels: StoryObj = {
  render: () => (
    <div className="grid max-w-3xl gap-4 md:grid-cols-2">
      <Panel title="Panel" detail="with detail" actions={<Button size="xs">Action</Button>}>
        <KeyValue
          items={[
            ["Key", "Value"],
            [
              "Spec hash",
              <span key="h" className="num text-xs">
                23c4240e4536fd2e
              </span>,
            ],
          ]}
        />
      </Panel>
      <Panel title="Empty panel" padded={false}>
        <EmptyState
          compact
          title="Nothing here yet"
          description="What is missing and what to do about it."
          action={<Button size="xs">Do the thing</Button>}
        />
      </Panel>
    </div>
  ),
};
