import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { Menu } from "./Menu";
import { Tabs } from "./Tabs";

const meta = { title: "Components/Dialog, Menu & Tabs" } satisfies Meta;
export default meta;

export const DialogStory: StoryObj = {
  name: "Dialog",
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open dialog</Button>
        <Dialog
          isOpen={open}
          onOpenChange={setOpen}
          title="Dialog title"
          description="One line of context about what happens next."
          actions={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => setOpen(false)}>
                Confirm
              </Button>
            </>
          }
        >
          <p className="text-sm text-ink-2">Body content.</p>
        </Dialog>
      </>
    );
  },
};

export const MenuStory: StoryObj = {
  name: "Menu",
  render: () => {
    const [visible, setVisible] = useState(["a", "b"]);
    return (
      <div className="flex gap-2">
        <Menu
          label="Actions"
          items={[
            { id: "a", label: "Re-run decide" },
            { id: "b", label: "Sync now", detail: "5s" },
            { id: "c", label: "Archive brief", danger: true, separatorBefore: true },
          ]}
          onAction={() => {}}
        />
        <Menu
          label="Columns"
          variant="ghost"
          items={[
            { id: "a", label: "Impressions" },
            { id: "b", label: "Spend" },
            { id: "c", label: "CTR" },
          ]}
          selectedIds={visible}
          onSelectionChange={setVisible}
        />
      </div>
    );
  },
};

export const TabsStory: StoryObj = {
  name: "Tabs",
  render: () => {
    const [tab, setTab] = useState("one");
    const [seg, setSeg] = useState("all");
    return (
      <div className="flex flex-col gap-6">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { id: "one", label: "Results", count: 6 },
            { id: "two", label: "Decisions", count: 3 },
            { id: "three", label: "Pre-flight" },
          ]}
        />
        <Tabs
          variant="segmented"
          value={seg}
          onChange={setSeg}
          items={[
            { id: "all", label: "All", count: 12 },
            { id: "pending", label: "Pending", count: 3 },
            { id: "approved", label: "Approved" },
          ]}
        />
      </div>
    );
  },
};
