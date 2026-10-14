import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { cx } from "./cx";

export interface AppShellProps {
  sidebar: ReactNode;
  children: ReactNode;
  /** Full-width strip above the content (e.g. kill switch engaged). */
  banner?: ReactNode;
}

/** Fixed left sidebar + scrolling main column. */
export function AppShell({ sidebar, children, banner }: AppShellProps) {
  return (
    <div className="flex h-dvh min-h-0 bg-canvas text-ink">
      {sidebar}
      <div className="flex min-w-0 flex-1 flex-col">
        {banner}
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

export interface SidebarProps {
  header?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function Sidebar({ header, children, footer, className }: SidebarProps) {
  return (
    <aside className={cx("flex w-[216px] shrink-0 flex-col border-r border-line bg-surface-2", className)}>
      {header && <div className="flex h-12 shrink-0 items-center px-4">{header}</div>}
      <nav className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-2 py-2">{children}</nav>
      {footer && <div className="flex shrink-0 flex-col gap-2 border-t border-line p-2">{footer}</div>}
    </aside>
  );
}

export function SidebarSection({ label, children }: { label?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-px">
      {label && (
        <span className="px-2 pb-1 text-2xs font-medium uppercase tracking-wider text-ink-4">{label}</span>
      )}
      {children}
    </div>
  );
}

type SidebarItemProps<C extends ElementType> = {
  /** Element or component to render (e.g. a router Link). Defaults to "a". */
  as?: C;
  active?: boolean;
  label: ReactNode;
  /** Right-aligned count; `countTone="pending"` makes it a filled pill. */
  count?: number;
  countTone?: "pending" | "neutral";
} & Omit<ComponentPropsWithoutRef<C>, "as" | "className" | "children">;

export function SidebarItem<C extends ElementType = "a">({
  as,
  active,
  label,
  count,
  countTone = "neutral",
  ...rest
}: SidebarItemProps<C>) {
  const Comp: ElementType = as ?? "a";
  return (
    <Comp
      {...rest}
      aria-current={active ? "page" : undefined}
      className={cx(
        "flex h-7 items-center justify-between gap-2 rounded-sm px-2 text-base transition-colors",
        active
          ? "bg-surface font-medium text-ink shadow-xs ring-1 ring-line"
          : "text-ink-2 hover:bg-surface-3 hover:text-ink",
      )}
    >
      <span className="truncate">{label}</span>
      {count !== undefined && count > 0 && (
        <span
          className={cx(
            "num min-w-5 rounded-xs px-1 text-center text-xs leading-[18px]",
            countTone === "pending" ? "bg-pending text-white" : "text-ink-3",
          )}
        >
          {count}
        </span>
      )}
    </Comp>
  );
}

export interface PageHeaderProps {
  title: ReactNode;
  /** Small text above the title (breadcrumb, entity type). */
  eyebrow?: ReactNode;
  subtitle?: ReactNode;
  /** Badges next to the title. */
  badges?: ReactNode;
  /** Row of <Stat inline> under the title. */
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/** The one place with generous whitespace. */
export function PageHeader({ title, eyebrow, subtitle, badges, meta, actions, className }: PageHeaderProps) {
  return (
    <header className={cx("flex flex-col gap-3 px-8 pt-7 pb-5", className)}>
      <div className="flex items-start justify-between gap-6">
        <div className="flex min-w-0 flex-col gap-1">
          {eyebrow && <div className="text-xs text-ink-3">{eyebrow}</div>}
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-semibold tracking-[-0.01em] text-ink">{title}</h1>
            {badges}
          </div>
          {subtitle && <p className="max-w-3xl text-sm text-ink-2">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {meta && <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">{meta}</div>}
    </header>
  );
}

/** Page body with consistent gutters. */
export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("flex flex-col gap-6 px-8 pb-12", className)}>{children}</div>;
}

export interface PanelProps {
  title?: ReactNode;
  /** Muted text after the title (count, timestamp). */
  detail?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  /** Pad the body (default true). Turn off for tables/lists that run edge to edge. */
  padded?: boolean;
  className?: string;
}

/** Bordered section with an optional title row. */
export function Panel({ title, detail, actions, children, padded = true, className }: PanelProps) {
  return (
    <section
      className={cx(
        "flex min-w-0 flex-col overflow-hidden rounded-md border border-line bg-surface",
        className,
      )}
    >
      {(title || actions) && (
        <div className="flex min-h-10 items-center justify-between gap-3 border-b border-line px-3.5 py-1.5">
          <div className="flex min-w-0 items-baseline gap-2">
            {title && <h2 className="truncate text-sm font-semibold text-ink">{title}</h2>}
            {detail && <span className="truncate text-xs text-ink-3">{detail}</span>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
        </div>
      )}
      <div className={cx(padded && "p-3.5")}>{children}</div>
    </section>
  );
}

/** Section heading outside a panel. */
export function SectionTitle({
  children,
  detail,
  actions,
}: {
  children: ReactNode;
  detail?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div className="flex items-baseline gap-2">
        <h2 className="text-sm font-semibold text-ink">{children}</h2>
        {detail && <span className="text-xs text-ink-3">{detail}</span>}
      </div>
      {actions}
    </div>
  );
}

/** Two-column key/value list. */
export function KeyValue({ items, className }: { items: Array<[ReactNode, ReactNode]>; className?: string }) {
  return (
    <dl className={cx("grid grid-cols-[minmax(96px,auto)_1fr] gap-x-4 gap-y-1.5 text-sm", className)}>
      {items.map(([k, v], i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static rows
        <div key={i} className="contents">
          <dt className="text-ink-3">{k}</dt>
          <dd className="min-w-0 break-words text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
