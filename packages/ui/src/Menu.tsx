import type { ReactNode } from "react";
import {
  Button as AriaButton,
  Menu as AriaMenu,
  MenuItem,
  MenuTrigger,
  Popover,
  type Selection,
  Separator,
} from "react-aria-components";
import { type ButtonSize, type ButtonVariant, buttonClass } from "./Button";
import { cx } from "./cx";

export interface MenuItemDef {
  id: string;
  label: ReactNode;
  /** Muted text on the right (shortcut, count). */
  detail?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  /** Draw a separator before this item. */
  separatorBefore?: boolean;
}

export interface MenuProps {
  /** Trigger button content. */
  label: ReactNode;
  items: MenuItemDef[];
  onAction?: (id: string) => void;
  /** Multiple selection mode (checkmarks), e.g. column visibility. */
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  placement?: "bottom start" | "bottom end";
  "aria-label"?: string;
}

const itemClass = ({ isFocused, isDisabled }: { isFocused: boolean; isDisabled: boolean }) =>
  cx(
    "flex cursor-default items-center gap-2 rounded-sm px-2 py-1 text-sm text-ink outline-none",
    isFocused && "bg-surface-3",
    isDisabled && "opacity-40",
  );

/** Dropdown menu (react-aria). Use `selectedIds` + `onSelectionChange` for a checklist menu. */
export function Menu({
  label,
  items,
  onAction,
  selectedIds,
  onSelectionChange,
  variant = "secondary",
  size = "sm",
  placement = "bottom end",
  ...aria
}: MenuProps) {
  const multi = selectedIds !== undefined;
  return (
    <MenuTrigger>
      <AriaButton className={buttonClass(variant, size)} aria-label={aria["aria-label"]}>
        {label}
        <svg viewBox="0 0 10 10" className="size-2.5 text-ink-3" aria-hidden="true">
          <path d="M2 4l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      </AriaButton>
      <Popover
        placement={placement}
        offset={4}
        className="min-w-44 rounded-md border border-line bg-surface p-1 shadow-pop outline-none"
      >
        <AriaMenu
          className="outline-none"
          onAction={(key) => onAction?.(String(key))}
          selectionMode={multi ? "multiple" : undefined}
          selectedKeys={multi ? new Set(selectedIds) : undefined}
          onSelectionChange={
            multi
              ? (keys: Selection) =>
                  onSelectionChange?.(keys === "all" ? items.map((i) => i.id) : [...keys].map(String))
              : undefined
          }
        >
          {items.flatMap((item) => {
            const node = (
              <MenuItem
                key={item.id}
                id={item.id}
                isDisabled={item.disabled}
                textValue={typeof item.label === "string" ? item.label : item.id}
                className={itemClass}
              >
                {({ isSelected }) => (
                  <>
                    {multi && (
                      <span
                        className={cx(
                          "flex size-3.5 items-center justify-center rounded-xs border",
                          isSelected ? "border-ink bg-ink text-surface" : "border-line-strong",
                        )}
                      >
                        {isSelected && (
                          <svg viewBox="0 0 10 10" className="size-2.5" aria-hidden="true">
                            <path d="M2 5.2l2 2 4-4.4" fill="none" stroke="currentColor" strokeWidth="1.5" />
                          </svg>
                        )}
                      </span>
                    )}
                    <span className={cx("flex-1", item.danger && "text-failed")}>{item.label}</span>
                    {item.detail && <span className="text-xs text-ink-3">{item.detail}</span>}
                  </>
                )}
              </MenuItem>
            );
            return item.separatorBefore
              ? [<Separator key={`${item.id}-sep`} className="my-1 h-px bg-line" />, node]
              : [node];
          })}
        </AriaMenu>
      </Popover>
    </MenuTrigger>
  );
}
