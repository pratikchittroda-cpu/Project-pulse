export type StatusTone = "accent" | "danger" | "neutral" | "success" | "warning";
export declare const designTokens: {
    readonly colors: {
        readonly accent: "#2563eb";
        readonly danger: "#dc2626";
        readonly neutral: "#64748b";
        readonly success: "#16a34a";
        readonly warning: "#d97706";
    };
    readonly radii: {
        readonly card: "1rem";
        readonly control: "0.7rem";
        readonly pill: "999px";
    };
};
export declare const statusTokens: {
    readonly backlog: {
        readonly label: "Backlog";
        readonly tone: "neutral";
    };
    readonly blocked: {
        readonly label: "Blocked";
        readonly tone: "danger";
    };
    readonly canceled: {
        readonly label: "Canceled";
        readonly tone: "neutral";
    };
    readonly changes_requested: {
        readonly label: "Changes requested";
        readonly tone: "warning";
    };
    readonly completed: {
        readonly label: "Completed";
        readonly tone: "success";
    };
    readonly in_progress: {
        readonly label: "In progress";
        readonly tone: "accent";
    };
    readonly in_review: {
        readonly label: "In review";
        readonly tone: "warning";
    };
    readonly planned: {
        readonly label: "Planned";
        readonly tone: "neutral";
    };
    readonly ready_to_merge: {
        readonly label: "Ready to merge";
        readonly tone: "success";
    };
};
export type TaskStatus = keyof typeof statusTokens;
export declare const priorityTokens: {
    readonly high: {
        readonly label: "High";
        readonly tone: "danger";
    };
    readonly low: {
        readonly label: "Low";
        readonly tone: "neutral";
    };
    readonly medium: {
        readonly label: "Medium";
        readonly tone: "warning";
    };
    readonly urgent: {
        readonly label: "Urgent";
        readonly tone: "danger";
    };
};
export type TaskPriority = keyof typeof priorityTokens;
//# sourceMappingURL=tokens.d.ts.map