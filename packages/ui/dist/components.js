import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { AlertCircle, CheckCircle2, ChevronDown, Circle, Info, TriangleAlert, X, } from "lucide-react";
import { forwardRef, useEffect, useId, useRef, } from "react";
import { priorityTokens, statusTokens, } from "./tokens.js";
function joinClasses(...classes) {
    return classes.filter(Boolean).join(" ");
}
export const Button = forwardRef(({ className, size = "md", variant = "primary", type = "button", ...props }, ref) => (_jsx("button", { ...props, className: joinClasses("pp-button", `pp-button-${size}`, `pp-button-${variant}`, className), ref: ref, type: type })));
Button.displayName = "Button";
export const Input = forwardRef(({ className, error, hint, id, label, ...inputProps }, ref) => {
    const generatedId = useId();
    const fieldId = id ?? generatedId;
    const hintId = hint ? `${fieldId}-hint` : undefined;
    const errorId = error ? `${fieldId}-error` : undefined;
    const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
    return (_jsxs("div", { className: "pp-field", children: [label ? (_jsx("label", { className: "pp-field-label", htmlFor: fieldId, children: label })) : null, _jsx("input", { ...inputProps, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined, className: joinClasses("pp-input", error && "pp-input-error", className), id: fieldId, ref: ref }), hint ? (_jsx("span", { className: "pp-field-hint", id: hintId, children: hint })) : null, error ? (_jsxs("span", { className: "pp-field-error", id: errorId, role: "alert", children: [_jsx(AlertCircle, { "aria-hidden": "true", size: 14 }), error] })) : null] }));
});
Input.displayName = "Input";
export function Card({ children, className, ...props }) {
    return (_jsx("section", { ...props, className: joinClasses("pp-card", className), children: children }));
}
export function CardHeader({ children, className, ...props }) {
    return (_jsx("div", { ...props, className: joinClasses("pp-card-header", className), children: children }));
}
export function CardTitle({ children, className, ...props }) {
    return (_jsx("h3", { ...props, className: joinClasses("pp-card-title", className), children: children }));
}
export function CardDescription({ children, className, ...props }) {
    return (_jsx("p", { ...props, className: joinClasses("pp-card-description", className), children: children }));
}
export function CardContent({ children, className, ...props }) {
    return (_jsx("div", { ...props, className: joinClasses("pp-card-content", className), children: children }));
}
export function Badge({ children, className, icon, tone = "neutral", ...props }) {
    return (_jsxs("span", { ...props, className: joinClasses("pp-badge", `pp-badge-${tone}`, className), children: [icon, _jsx("span", { children: children })] }));
}
const statusIcons = {
    accent: Circle,
    danger: AlertCircle,
    neutral: Circle,
    success: CheckCircle2,
    warning: TriangleAlert,
};
export function StatusBadge({ label, status }) {
    const token = statusTokens[status];
    const Icon = statusIcons[token.tone];
    return (_jsx(Badge, { "aria-label": `Status: ${label ?? token.label}`, icon: _jsx(Icon, { "aria-hidden": "true", size: 14 }), tone: token.tone, children: label ?? token.label }));
}
export function PriorityBadge({ priority }) {
    const token = priorityTokens[priority];
    return _jsxs(Badge, { tone: token.tone, children: [token.label, " priority"] });
}
export function Dialog({ children, description, onClose, open, title, }) {
    const closeButtonRef = useRef(null);
    const titleId = useId();
    const descriptionId = useId();
    useEffect(() => {
        if (!open) {
            return undefined;
        }
        closeButtonRef.current?.focus();
        const handleKeyDown = (event) => {
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
    return (_jsx("div", { "aria-hidden": "false", className: "pp-dialog-backdrop", onMouseDown: onClose, children: _jsxs("section", { "aria-describedby": description ? descriptionId : undefined, "aria-labelledby": titleId, "aria-modal": "true", className: "pp-dialog", onMouseDown: (event) => event.stopPropagation(), role: "dialog", children: [_jsxs("header", { className: "pp-dialog-header", children: [_jsxs("div", { children: [_jsx("h2", { id: titleId, children: title }), description ? _jsx("p", { id: descriptionId, children: description }) : null] }), _jsx(Button, { "aria-label": "Close dialog", className: "pp-icon-button", onClick: onClose, ref: closeButtonRef, variant: "ghost", children: _jsx(X, { "aria-hidden": "true", size: 18 }) })] }), _jsx("div", { className: "pp-dialog-content", children: children })] }) }));
}
export function Tabs({ ariaLabel = "Sections", onChange, tabs, value, }) {
    const tabRefs = useRef([]);
    const activeIndex = Math.max(0, tabs.findIndex((tab) => tab.id === value));
    function handleKeyDown(event, index) {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
            return;
        }
        event.preventDefault();
        const enabledIndexes = tabs.flatMap((tab, tabIndex) => tab.disabled ? [] : [tabIndex]);
        const enabledPosition = enabledIndexes.indexOf(index);
        if (enabledPosition === -1 || enabledIndexes.length === 0) {
            return;
        }
        const nextPosition = event.key === "Home"
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
    return (_jsxs("div", { className: "pp-tabs", children: [_jsx("div", { "aria-label": ariaLabel, className: "pp-tab-list", role: "tablist", children: tabs.map((tab, index) => (_jsx("button", { "aria-selected": tab.id === value, className: joinClasses("pp-tab", tab.id === value && "pp-tab-active"), disabled: tab.disabled, onClick: () => onChange(tab.id), onKeyDown: (event) => handleKeyDown(event, index), ref: (element) => {
                        tabRefs.current[index] = element;
                    }, role: "tab", tabIndex: tab.id === value ? 0 : -1, type: "button", children: tab.label }, tab.id))) }), _jsxs("span", { className: "sr-only", children: ["Active tab: ", tabs[activeIndex]?.label] })] }));
}
export function TabPanel({ active = true, children, className, id, ...props }) {
    if (!active) {
        return null;
    }
    return (_jsx("div", { ...props, "aria-labelledby": id ? `${id}-tab` : undefined, className: joinClasses("pp-tab-panel", className), id: id, role: "tabpanel", tabIndex: 0, children: children }));
}
export function Menu({ items, label, }) {
    return (_jsxs("details", { className: "pp-menu", children: [_jsxs("summary", { "aria-haspopup": "menu", className: "pp-menu-trigger", children: [label, _jsx(ChevronDown, { "aria-hidden": "true", size: 16 })] }), _jsx("div", { className: "pp-menu-items", role: "menu", children: items.map((item) => (_jsx("button", { disabled: item.disabled, onClick: (event) => {
                        item.onSelect();
                        event.currentTarget.closest("details")?.removeAttribute("open");
                    }, role: "menuitem", type: "button", children: item.label }, item.label))) })] }));
}
export function DataTable({ caption, columns, rows, }) {
    return (_jsx("div", { className: "pp-table-wrapper", children: _jsxs("table", { className: "pp-table", children: [_jsx("caption", { children: caption }), _jsx("thead", { children: _jsx("tr", { children: columns.map((column) => (_jsx("th", { scope: "col", children: column.label }, column.key))) }) }), _jsx("tbody", { children: rows.map((row, index) => (_jsx("tr", { children: columns.map((column) => (_jsx("td", { children: row[column.key] }, column.key))) }, String(row.id ?? index)))) })] }) }));
}
export function Toast({ message, onDismiss, title, tone = "neutral", }) {
    const Icon = tone === "success" ? CheckCircle2 : tone === "danger" ? AlertCircle : Info;
    return (_jsxs("div", { "aria-live": tone === "danger" ? "assertive" : "polite", className: joinClasses("pp-toast", `pp-toast-${tone}`), role: tone === "danger" ? "alert" : "status", children: [_jsx(Icon, { "aria-hidden": "true", size: 18 }), _jsxs("div", { children: [_jsx("strong", { children: title }), _jsx("p", { children: message })] }), onDismiss ? (_jsx(Button, { "aria-label": "Dismiss notification", className: "pp-icon-button", onClick: onDismiss, variant: "ghost", children: _jsx(X, { "aria-hidden": "true", size: 16 }) })) : null] }));
}
export function PageLayout({ actions, children, description, eyebrow, title, }) {
    return (_jsxs("div", { className: "pp-page-layout", children: [_jsxs("header", { className: "pp-page-heading", children: [_jsxs("div", { children: [eyebrow ? _jsx("p", { className: "pp-eyebrow", children: eyebrow }) : null, _jsx("h1", { children: title }), description ? _jsx("p", { children: description }) : null] }), actions ? _jsx("div", { className: "pp-page-actions", children: actions }) : null] }), children] }));
}
//# sourceMappingURL=components.js.map