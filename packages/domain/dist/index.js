export const PROJECT_NAME = "ProjectPulse";
export const DEFAULT_TASK_STATUSES = [
    "backlog",
    "planned",
    "in_progress",
    "blocked",
    "in_review",
    "changes_requested",
    "ready_to_merge",
    "completed",
    "canceled",
];
export const DEFAULT_TASK_PRIORITIES = [
    "urgent",
    "high",
    "medium",
    "low",
];
const EVENT_NAME_PATTERN = /^[a-z0-9]+(?:[._][a-z0-9]+)+$/;
const ISO_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const PROJECT_KEY_PATTERN = /^[A-Z][A-Z0-9]{1,9}$/;
const TASK_NUMBER_PATTERN = /^[1-9]\d*$/;
const TASK_KEY_PATTERN = /^[A-Z][A-Z0-9]{1,9}-[1-9]\d*$/;
export function isProjectKey(value) {
    return typeof value === "string" && PROJECT_KEY_PATTERN.test(value);
}
export function isTaskKey(value) {
    return typeof value === "string" && TASK_KEY_PATTERN.test(value);
}
export function formatTaskKey(projectKey, taskNumber) {
    const normalizedProjectKey = projectKey.trim().toUpperCase();
    const normalizedTaskNumber = String(taskNumber);
    if (!isProjectKey(normalizedProjectKey)) {
        throw new RangeError("Expected a valid uppercase project key");
    }
    if (!TASK_NUMBER_PATTERN.test(normalizedTaskNumber)) {
        throw new RangeError("Expected a positive task number");
    }
    return `${normalizedProjectKey}-${normalizedTaskNumber}`;
}
export function isEventName(value) {
    return typeof value === "string" && EVENT_NAME_PATTERN.test(value);
}
export function isIsoDateTime(value) {
    return (typeof value === "string" &&
        ISO_DATE_TIME_PATTERN.test(value) &&
        !Number.isNaN(Date.parse(value)));
}
export function toIsoDateTime(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new RangeError("Expected a valid date for ISO serialization");
    }
    return date.toISOString();
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function requiredString(input, field, issues) {
    const value = input[field];
    if (typeof value !== "string" || value.trim().length === 0) {
        issues.push({ field, message: "Expected a non-empty string" });
        return undefined;
    }
    return value;
}
export function parseEventEnvelope(input) {
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
    const issues = [];
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
            actorId: input.actorId,
            correlationId: input.correlationId,
            entityId: entityId,
            entityType: entityType,
            eventId: eventId,
            eventType: eventType,
            idempotencyKey: idempotencyKey,
            occurredAt: occurredAt,
            organizationId: organizationId,
            payload: input.payload,
            projectId: input.projectId,
            receivedAt: receivedAt,
            source: source,
        },
    };
}
//# sourceMappingURL=index.js.map