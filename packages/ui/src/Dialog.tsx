import type { ReactNode } from "react";
import { Dialog as AriaDialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import { cx } from "./cx";

export interface DialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  /** One-line context under the title. */
  description?: ReactNode;
  children?: ReactNode;
  /** Footer actions, right-aligned. */
  actions?: ReactNode;
  /** Close on outside click / Escape (default true). Turn off while submitting. */
  dismissable?: boolean;
  /** Danger dialogs get a red rule above the title. */
  tone?: "default" | "danger";
  width?: number;
}

/** Modal dialog built on react-aria (focus trap, Escape, scroll lock). Controlled. */
export function Dialog({
  isOpen,
  onOpenChange,
  title,
  description,
  children,
  actions,
  dismissable = true,
  tone = "default",
  width = 440,
}: DialogProps) {
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable={dismissable}
      isKeyboardDismissDisabled={!dismissable}
      className="fixed inset-0 z-50 flex items-start justify-center bg-[rgb(10_10_12/0.32)] px-4 pt-[12vh]"
    >
      <Modal className="w-full outline-none" style={{ maxWidth: width }}>
        <AriaDialog
          className={cx(
            "overflow-hidden rounded-md border border-line bg-surface shadow-pop outline-none",
            tone === "danger" && "border-t-2 border-t-danger",
          )}
        >
          <div className="flex flex-col gap-1 px-4 pt-4 pb-3">
            <Heading slot="title" className="text-md font-semibold text-ink">
              {title}
            </Heading>
            {description && <p className="text-sm text-ink-2">{description}</p>}
          </div>
          {children && <div className="px-4 pb-4">{children}</div>}
          {actions && (
            <div className="flex justify-end gap-2 border-t border-line bg-surface-2 px-4 py-2.5">
              {actions}
            </div>
          )}
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}
