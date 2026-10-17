export type StatusTone =
  | "accent"
  | "danger"
  | "neutral"
  | "success"
  | "warning";

export const designTokens = {
  colors: {
    accent: "#2563eb",
    danger: "#dc2626",
    neutral: "#64748b",
    success: "#16a34a",
    warning: "#d97706",
  },
  radii: {
    card: "1rem",
    control: "0.7rem",
    pill: "999px",
  },
} as const;

export const statusTokens = {
  blocked: { label: "Blocked", tone: "danger" },
  completed: { label: "Completed", tone: "success" },
  in_progress: { label: "In progress", tone: "accent" },
  in_review: { label: "In review", tone: "warning" },
  planned: { label: "Planned", tone: "neutral" },
} as const satisfies Record<string, { label: string; tone: StatusTone }>;

export type TaskStatus = keyof typeof statusTokens;

export const priorityTokens = {
  high: { label: "High", tone: "danger" },
  low: { label: "Low", tone: "neutral" },
  medium: { label: "Medium", tone: "warning" },
  urgent: { label: "Urgent", tone: "danger" },
} as const satisfies Record<string, { label: string; tone: StatusTone }>;

export type TaskPriority = keyof typeof priorityTokens;
