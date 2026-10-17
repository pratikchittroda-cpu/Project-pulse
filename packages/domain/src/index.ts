export const PROJECT_NAME = "ProjectPulse" as const;

export interface WorkspacePackage {
  name: string;
  responsibility: string;
}

export type TaskStatus =
  | "backlog"
  | "blocked"
  | "canceled"
  | "changes_requested"
  | "completed"
  | "in_progress"
  | "in_review"
  | "planned"
  | "ready_to_merge";

export type TaskPriority = "urgent" | "high" | "medium" | "low";

export type IsoDateTime = string & { readonly __isoDateTime: unique symbol };

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

export type CoreEventName =
  | "github.pull_request.opened"
  | "presence.updated"
  | "task.created"
  | "telemetry.session_started";

export type EventName = CoreEventName | (string & {});
export type EventSource = "extension" | "github" | "internal" | "system";
export type EventEntityType =
  | "deployment"
  | "pull_request"
  | "repository"
  | "task"
  | "telemetry_session";

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

export type ApiErrorCode =
  | "forbidden"
  | "invalid_request"
  | "not_found"
  | "rate_limited"
  | "unknown";

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

export type ValidationResult<T> =
  | { error: ValidationError; ok: false }
  | { ok: true; value: T };

const EVENT_NAME_PATTERN = /^[a-z0-9]+(?:[._][a-z0-9]+)+$/;
const ISO_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function isEventName(value: unknown): value is EventName {
  return typeof value === "string" && EVENT_NAME_PATTERN.test(value);
}

export function isIsoDateTime(value: unknown): value is IsoDateTime {
  return (
    typeof value === "string" &&
    ISO_DATE_TIME_PATTERN.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

export function toIsoDateTime(value: Date | number | string): IsoDateTime {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new RangeError("Expected a valid date for ISO serialization");
  }

  return date.toISOString() as IsoDateTime;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(
  input: Record<string, unknown>,
  field: string,
  issues: ValidationIssue[],
) {
  const value = input[field];

  if (typeof value !== "string" || value.trim().length === 0) {
    issues.push({ field, message: "Expected a non-empty string" });
    return undefined;
  }

  return value;
}

export function parseEventEnvelope<TPayload = JsonValue>(
  input: unknown,
): ValidationResult<EventEnvelope<TPayload>> {
  if (!isRecord(input)) {
    return {
      error: {
        code: "invalid_event_envelope",
        issues: [{ field: "event", message: "Expected an object" }],
        message: "Event envelope validation failed",
      },
      ok: false,
    };
  }

  const issues: ValidationIssue[] = [];
  const eventId = requiredString(input, "eventId", issues);
  const source = requiredString(input, "source", issues);
  const eventType = requiredString(input, "eventType", issues);
  const organizationId = requiredString(input, "organizationId", issues);
  const entityType = requiredString(input, "entityType", issues);
  const entityId = requiredString(input, "entityId", issues);
  const idempotencyKey = requiredString(input, "idempotencyKey", issues);
  const occurredAt = requiredString(input, "occurredAt", issues);
  const receivedAt = requiredString(input, "receivedAt", issues);

  if (eventType && !isEventName(eventType)) {
    issues.push({
      field: "eventType",
      message: "Expected a lower-case dot-separated event name",
    });
  }
  if (occurredAt && !isIsoDateTime(occurredAt)) {
    issues.push({ field: "occurredAt", message: "Expected an ISO date-time" });
  }
  if (receivedAt && !isIsoDateTime(receivedAt)) {
    issues.push({ field: "receivedAt", message: "Expected an ISO date-time" });
  }
  if (!("payload" in input) || input.payload === undefined) {
    issues.push({ field: "payload", message: "Payload is required" });
  }

  for (const field of ["projectId", "actorId", "correlationId"]) {
    const value = input[field];
    if (value !== undefined && typeof value !== "string") {
      issues.push({ field, message: "Expected a string when provided" });
    }
  }

  if (issues.length > 0) {
    return {
      error: {
        code: "invalid_event_envelope",
        issues,
        message: "Event envelope validation failed",
      },
      ok: false,
    };
  }

  return {
    ok: true,
    value: {
      actorId: input.actorId as string | undefined,
      correlationId: input.correlationId as string | undefined,
      entityId: entityId as string,
      entityType: entityType as string,
      eventId: eventId as string,
      eventType: eventType as EventName,
      idempotencyKey: idempotencyKey as string,
      occurredAt: occurredAt as IsoDateTime,
      organizationId: organizationId as string,
      payload: input.payload as TPayload,
      projectId: input.projectId as string | undefined,
      receivedAt: receivedAt as IsoDateTime,
      source: source as EventSource,
    },
  };
}
