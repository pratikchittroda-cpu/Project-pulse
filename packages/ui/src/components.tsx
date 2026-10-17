import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Circle,
  Info,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import {
  priorityTokens,
  statusTokens,
  type StatusTone,
  type TaskPriority,
  type TaskStatus,
} from "./tokens.js";

function joinClasses(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export type ButtonVariant = "danger" | "ghost" | "primary" | "secondary";
export type ButtonSize = "lg" | "md" | "sm";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: ButtonSize;
  variant?: ButtonVariant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, size = "md", variant = "primary", type = "button", ...props },
    ref,
  ) => (
    <button
      {...props}
      className={joinClasses(
        "pp-button",
        `pp-button-${size}`,
        `pp-button-${variant}`,
        className,
      )}
      ref={ref}
      type={type}
    />
  ),
);

Button.displayName = "Button";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  hint?: string;
  label?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, hint, id, label, ...inputProps }, ref) => {
    const generatedId = useId();
    const fieldId = id ?? generatedId;
    const hintId = hint ? `${fieldId}-hint` : undefined;
    const errorId = error ? `${fieldId}-error` : undefined;
    const describedBy =
      [hintId, errorId].filter(Boolean).join(" ") || undefined;

    return (
      <div className="pp-field">
        {label ? (
          <label className="pp-field-label" htmlFor={fieldId}>
            {label}
          </label>
        ) : null}
        <input
          {...inputProps}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={joinClasses(
            "pp-input",
            error && "pp-input-error",
            className,
          )}
          id={fieldId}
          ref={ref}
        />
        {hint ? (
          <span className="pp-field-hint" id={hintId}>
            {hint}
          </span>
        ) : null}
        {error ? (
          <span className="pp-field-error" id={errorId} role="alert">
            <AlertCircle aria-hidden="true" size={14} />
            {error}
          </span>
        ) : null}
      </div>
    );
  },
);

Input.displayName = "Input";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ children, className, ...props }: CardProps) {
  return (
    <section {...props} className={joinClasses("pp-card", className)}>
      {children}
    </section>
  );
}

export function CardHeader({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={joinClasses("pp-card-header", className)}>
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 {...props} className={joinClasses("pp-card-title", className)}>
      {children}
    </h3>
  );
}

export function CardDescription({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p {...props} className={joinClasses("pp-card-description", className)}>
      {children}
    </p>
  );
}

export function CardContent({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={joinClasses("pp-card-content", className)}>
      {children}
    </div>
  );
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  icon?: ReactNode;
  tone?: StatusTone;
}

export function Badge({
  children,
  className,
  icon,
  tone = "neutral",
  ...props
}: BadgeProps) {
  return (
    <span
      {...props}
      className={joinClasses("pp-badge", `pp-badge-${tone}`, className)}
    >
      {icon}
      <span>{children}</span>
    </span>
  );
}

const statusIcons: Record<StatusTone, LucideIcon> = {
  accent: Circle,
  danger: AlertCircle,
  neutral: Circle,
  success: CheckCircle2,
  warning: TriangleAlert,
};

export interface StatusBadgeProps {
  label?: string;
  status: TaskStatus;
}

export function StatusBadge({ label, status }: StatusBadgeProps) {
  const token = statusTokens[status];
  const Icon = statusIcons[token.tone];

  return (
    <Badge
      aria-label={`Status: ${label ?? token.label}`}
      icon={<Icon aria-hidden="true" size={14} />}
      tone={token.tone}
    >
      {label ?? token.label}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const token = priorityTokens[priority];

  return <Badge tone={token.tone}>{token.label} priority</Badge>;
}

export interface DialogProps {
  children: ReactNode;
  description?: string;
  onClose: () => void;
  open: boolean;
  title: string;
}

export function Dialog({
  children,
  description,
  onClose,
  open,
  title,
}: DialogProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    closeButtonRef.current?.focus();
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      aria-hidden="false"
      className="pp-dialog-backdrop"
      onMouseDown={onClose}
    >
      <section
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className="pp-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="pp-dialog-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          <Button
            aria-label="Close dialog"
            className="pp-icon-button"
            onClick={onClose}
            ref={closeButtonRef}
            variant="ghost"
          >
            <X aria-hidden="true" size={18} />
          </Button>
        </header>
        <div className="pp-dialog-content">{children}</div>
      </section>
    </div>
  );
}

export interface TabDefinition {
  disabled?: boolean;
  id: string;
  label: ReactNode;
}

export interface TabsProps {
  ariaLabel?: string;
  onChange: (id: string) => void;
  tabs: readonly TabDefinition[];
  value: string;
}

export function Tabs({
  ariaLabel = "Sections",
  onChange,
  tabs,
  value,
}: TabsProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.id === value),
  );

  function handleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      return;
    }

    event.preventDefault();
    const enabledIndexes = tabs.flatMap((tab, tabIndex) =>
      tab.disabled ? [] : [tabIndex],
    );
    const enabledPosition = enabledIndexes.indexOf(index);

    if (enabledPosition === -1 || enabledIndexes.length === 0) {
      return;
    }

    const nextPosition =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? enabledIndexes.length - 1
          : (enabledPosition +
              (event.key === "ArrowRight" ? 1 : -1) +
              enabledIndexes.length) %
            enabledIndexes.length;
    const nextIndex = enabledIndexes[nextPosition];

    if (nextIndex === undefined) {
      return;
    }

    const nextTab = tabs[nextIndex];

    if (!nextTab) {
      return;
    }

    onChange(nextTab.id);
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <div className="pp-tabs">
      <div aria-label={ariaLabel} className="pp-tab-list" role="tablist">
        {tabs.map((tab, index) => (
          <button
            aria-selected={tab.id === value}
            className={joinClasses(
              "pp-tab",
              tab.id === value && "pp-tab-active",
            )}
            disabled={tab.disabled}
            key={tab.id}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            role="tab"
            tabIndex={tab.id === value ? 0 : -1}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>
      <span className="sr-only">Active tab: {tabs[activeIndex]?.label}</span>
    </div>
  );
}

export function TabPanel({
  active = true,
  children,
  className,
  id,
  ...props
}: HTMLAttributes<HTMLDivElement> & { active?: boolean }) {
  if (!active) {
    return null;
  }

  return (
    <div
      {...props}
      aria-labelledby={id ? `${id}-tab` : undefined}
      className={joinClasses("pp-tab-panel", className)}
      id={id}
      role="tabpanel"
      tabIndex={0}
    >
      {children}
    </div>
  );
}

export interface MenuItem {
  disabled?: boolean;
  label: string;
  onSelect: () => void;
}

export function Menu({
  items,
  label,
}: {
  items: readonly MenuItem[];
  label: string;
}) {
  return (
    <details className="pp-menu">
      <summary aria-haspopup="menu" className="pp-menu-trigger">
        {label}
        <ChevronDown aria-hidden="true" size={16} />
      </summary>
      <div className="pp-menu-items" role="menu">
        {items.map((item) => (
          <button
            disabled={item.disabled}
            key={item.label}
            onClick={(event) => {
              item.onSelect();
              event.currentTarget.closest("details")?.removeAttribute("open");
            }}
            role="menuitem"
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>
    </details>
  );
}

export interface TableColumn {
  key: string;
  label: string;
}

export function DataTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: readonly TableColumn[];
  rows: readonly Record<string, ReactNode>[];
}) {
  return (
    <div className="pp-table-wrapper">
      <table className="pp-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={String(row.id ?? index)}>
              {columns.map((column) => (
                <td key={column.key}>{row[column.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Toast({
  message,
  onDismiss,
  title,
  tone = "neutral",
}: {
  message: string;
  onDismiss?: () => void;
  title: string;
  tone?: StatusTone;
}) {
  const Icon =
    tone === "success" ? CheckCircle2 : tone === "danger" ? AlertCircle : Info;

  return (
    <div
      aria-live={tone === "danger" ? "assertive" : "polite"}
      className={joinClasses("pp-toast", `pp-toast-${tone}`)}
      role={tone === "danger" ? "alert" : "status"}
    >
      <Icon aria-hidden="true" size={18} />
      <div>
        <strong>{title}</strong>
        <p>{message}</p>
      </div>
      {onDismiss ? (
        <Button
          aria-label="Dismiss notification"
          className="pp-icon-button"
          onClick={onDismiss}
          variant="ghost"
        >
          <X aria-hidden="true" size={16} />
        </Button>
      ) : null}
    </div>
  );
}

export function PageLayout({
  actions,
  children,
  description,
  eyebrow,
  title,
}: {
  actions?: ReactNode;
  children: ReactNode;
  description?: string;
  eyebrow?: string;
  title: string;
}) {
  return (
    <div className="pp-page-layout">
      <header className="pp-page-heading">
        <div>
          {eyebrow ? <p className="pp-eyebrow">{eyebrow}</p> : null}
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
        </div>
        {actions ? <div className="pp-page-actions">{actions}</div> : null}
      </header>
      {children}
    </div>
  );
}
