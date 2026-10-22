export declare const PROJECT_NAME: "ProjectPulse";
export interface WorkspacePackage {
    name: string;
    responsibility: string;
}
export declare const DEFAULT_TASK_STATUSES: readonly ["backlog", "planned", "in_progress", "blocked", "in_review", "changes_requested", "ready_to_merge", "completed", "canceled"];
export type DefaultTaskStatus = (typeof DEFAULT_TASK_STATUSES)[number];
/** Project workflow configuration may add status keys without changing task identity. */
export type TaskStatus = DefaultTaskStatus | (string & {});
export type TaskPriority = "urgent" | "high" | "medium" | "low";
export declare const DEFAULT_TASK_PRIORITIES: readonly ["urgent", "high", "medium", "low"];
export interface TaskWorkflowStatus {
    isTerminal: boolean;
    label: string;
    position: number;
    projectId: string;
    status: string;
}
export type IsoDateTime = string & {
    readonly __isoDateTime: unique symbol;
};
export type JsonPrimitive = boolean | null | number | string;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
    [key: string]: JsonValue;
}
export interface Organization {
    createdAt: IsoDateTime;
    id: string;
    name: string;
    slug: string;
}
export type MemberRole = "admin" | "member" | "owner" | "viewer";
export interface Member {
    displayName: string;
    id: string;
    organizationId: string;
    role: MemberRole;
    userId: string;
}
export interface Team {
    id: string;
    name: string;
    organizationId: string;
    teamKey: string;
}
export interface Project {
    createdAt: IsoDateTime;
    id: string;
    name: string;
    organizationId: string;
    projectKey: string;
}
export type RepositoryProvider = "github" | "gitlab" | "other";
export interface Repository {
    defaultBranch: string;
    id: string;
    name: string;
    projectId: string;
    provider: RepositoryProvider;
    url: string;
}
export interface Task {
    assigneeId: string | null;
    createdAt: IsoDateTime;
    description: string | null;
    id: string;
    key: string;
    number: number;
    priority: TaskPriority;
    projectId: string;
    status: TaskStatus;
    title: string;
    updatedAt: IsoDateTime;
}
export type IntegrationProvider = "github" | "slack" | "teams" | "vscode";
export type IntegrationStatus = "connected" | "disconnected" | "error";
export interface Integration {
    createdAt: IsoDateTime;
    id: string;
    organizationId: string;
    provider: IntegrationProvider;
    status: IntegrationStatus;
}
export type CoreEventName = "github.pull_request.opened" | "presence.updated" | "task.archived" | "task.created" | "task.status_changed" | "task.updated" | "telemetry.session_started";
export type EventName = CoreEventName | (string & {});
export type EventSource = "extension" | "github" | "internal" | "system";
export type EventEntityType = "deployment" | "pull_request" | "repository" | "task" | "telemetry_session";
export interface EventEnvelope<TPayload = JsonValue> {
    actorId?: string;
    correlationId?: string;
    entityId: string;
    entityType: EventEntityType | string;
    eventId: string;
    eventType: EventName;
    idempotencyKey: string;
    occurredAt: IsoDateTime;
    organizationId: string;
    payload: TPayload;
    projectId?: string;
    receivedAt: IsoDateTime;
    source: EventSource | string;
}
/** Provider payloads stay outside the normalized domain event envelope. */
export interface ProviderEvent<TPayload = JsonValue> {
    deliveryId: string;
    payload: TPayload;
    provider: IntegrationProvider;
    providerEventType: string;
}
export interface PageInfo {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    page: number;
    pageSize: number;
    total: number;
}
export interface Paginated<T> {
    items: T[];
    pageInfo: PageInfo;
}
export interface ApiSuccess<T> {
    data: T;
    meta?: {
        requestId?: string;
    };
    ok: true;
}
export type ApiErrorCode = "forbidden" | "invalid_request" | "not_found" | "rate_limited" | "unknown";
export interface ApiError {
    code: ApiErrorCode;
    details?: JsonObject;
    message: string;
}
export interface ApiFailure {
    error: ApiError;
    ok: false;
}
export type ApiResponse<T> = ApiFailure | ApiSuccess<T>;
export interface ValidationIssue {
    field: string;
    message: string;
}
export interface ValidationError {
    code: "invalid_event_envelope";
    issues: ValidationIssue[];
    message: string;
}
export type ValidationResult<T> = {
    error: ValidationError;
    ok: false;
} | {
    ok: true;
    value: T;
};
export declare function isProjectKey(value: unknown): value is string;
export declare function isTaskKey(value: unknown): value is string;
export declare function formatTaskKey(projectKey: string, taskNumber: bigint | number | string): string;
export declare function isEventName(value: unknown): value is EventName;
export declare function isIsoDateTime(value: unknown): value is IsoDateTime;
export declare function toIsoDateTime(value: Date | number | string): IsoDateTime;
export declare function parseEventEnvelope<TPayload = JsonValue>(input: unknown): ValidationResult<EventEnvelope<TPayload>>;
//# sourceMappingURL=index.d.ts.map