import { type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { type StatusTone, type TaskPriority, type TaskStatus } from "./tokens.js";
export type ButtonVariant = "danger" | "ghost" | "primary" | "secondary";
export type ButtonSize = "lg" | "md" | "sm";
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    size?: ButtonSize;
    variant?: ButtonVariant;
}
export declare const Button: import("react").ForwardRefExoticComponent<ButtonProps & import("react").RefAttributes<HTMLButtonElement>>;
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    error?: string;
    hint?: string;
    label?: string;
}
export declare const Input: import("react").ForwardRefExoticComponent<InputProps & import("react").RefAttributes<HTMLInputElement>>;
export interface CardProps extends HTMLAttributes<HTMLDivElement> {
    children: ReactNode;
}
export declare function Card({ children, className, ...props }: CardProps): import("react/jsx-runtime").JSX.Element;
export declare function CardHeader({ children, className, ...props }: HTMLAttributes<HTMLDivElement>): import("react/jsx-runtime").JSX.Element;
export declare function CardTitle({ children, className, ...props }: HTMLAttributes<HTMLHeadingElement>): import("react/jsx-runtime").JSX.Element;
export declare function CardDescription({ children, className, ...props }: HTMLAttributes<HTMLParagraphElement>): import("react/jsx-runtime").JSX.Element;
export declare function CardContent({ children, className, ...props }: HTMLAttributes<HTMLDivElement>): import("react/jsx-runtime").JSX.Element;
export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
    icon?: ReactNode;
    tone?: StatusTone;
}
export declare function Badge({ children, className, icon, tone, ...props }: BadgeProps): import("react/jsx-runtime").JSX.Element;
export interface StatusBadgeProps {
    label?: string;
    status: TaskStatus;
}
export declare function StatusBadge({ label, status }: StatusBadgeProps): import("react/jsx-runtime").JSX.Element;
export declare function PriorityBadge({ priority }: {
    priority: TaskPriority;
}): import("react/jsx-runtime").JSX.Element;
export interface DialogProps {
    children: ReactNode;
    description?: string;
    onClose: () => void;
    open: boolean;
    title: string;
}
export declare function Dialog({ children, description, onClose, open, title, }: DialogProps): import("react/jsx-runtime").JSX.Element | null;
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
export declare function Tabs({ ariaLabel, onChange, tabs, value, }: TabsProps): import("react/jsx-runtime").JSX.Element;
export declare function TabPanel({ active, children, className, id, ...props }: HTMLAttributes<HTMLDivElement> & {
    active?: boolean;
}): import("react/jsx-runtime").JSX.Element | null;
export interface MenuItem {
    disabled?: boolean;
    label: string;
    onSelect: () => void;
}
export declare function Menu({ items, label, }: {
    items: readonly MenuItem[];
    label: string;
}): import("react/jsx-runtime").JSX.Element;
export interface TableColumn {
    key: string;
    label: string;
}
export declare function DataTable({ caption, columns, rows, }: {
    caption: string;
    columns: readonly TableColumn[];
    rows: readonly Record<string, ReactNode>[];
}): import("react/jsx-runtime").JSX.Element;
export declare function Toast({ message, onDismiss, title, tone, }: {
    message: string;
    onDismiss?: () => void;
    title: string;
    tone?: StatusTone;
}): import("react/jsx-runtime").JSX.Element;
export declare function PageLayout({ actions, children, description, eyebrow, title, }: {
    actions?: ReactNode;
    children: ReactNode;
    description?: string;
    eyebrow?: string;
    title: string;
}): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=components.d.ts.map