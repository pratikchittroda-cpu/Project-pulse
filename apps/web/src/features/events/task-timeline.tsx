import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@projectpulse/ui";
import type { JsonValue } from "@projectpulse/domain";
import { useTaskEvents } from "./use-task-events.js";
import type {
  TaskEventRecord,
  TaskEventRepository,
  TaskEventScope,
} from "./task-events-repository.js";

const eventLabels: Record<string, string> = {
  "task.created": "Task created",
  "task.updated": "Task updated",
  "task.status_changed": "Status changed",
  "task.archived": "Task archived",
  "task.restored": "Task restored",
  "task.comment_created": "Comment added",
  "task.comment_edited": "Comment edited",
  "task.comment_deleted": "Comment deleted",
  "task.comment_mentioned": "Mention notification queued",
  "task.attachment_added": "Attachment added",
  "task.checklist_item_created": "Checklist item added",
  "task.checklist_item_toggled": "Checklist item updated",
  "task.checklist_item_deleted": "Checklist item deleted",
};
const fieldLabels: Record<string, string> = {
  title: "Title",
  description: "Description",
  status: "Status",
  priority: "Priority",
  assignee_id: "Assignee",
  labels: "Labels",
  estimate: "Estimate",
  due_date: "Due date",
  archived_at: "Archived at",
  cycle_id: "Sprint",
  team_id: "Team",
  epic_id: "Epic",
  milestone_id: "Milestone",
};
function record(
  value: JsonValue | undefined,
): value is Record<string, JsonValue> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function display(value: JsonValue | undefined): string {
  if (value === null || value === undefined || value === "") return "Not set";
  if (Array.isArray(value))
    return value.length ? value.map(display).join(", ") : "None";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function TimelineEntry({
  event,
  currentUserId,
}: {
  event: TaskEventRecord;
  currentUserId: string;
}) {
  const payload = record(event.payload) ? event.payload : {};
  const changes = record(payload.changes) ? payload.changes : {};
  const fieldChanges = Object.entries(changes).filter(
    ([, change]) => record(change) && ("from" in change || "to" in change),
  );
  const mode =
    payload.mode === "automated" || event.source === "system"
      ? "Automated"
      : event.source === "internal"
        ? "Manual"
        : "Provider";
  const reason = typeof payload.reason === "string" ? payload.reason : null;
  const redacted =
    payload.contentState === "redacted" ||
    event.eventType === "task.comment_deleted" ||
    event.eventType === "task.checklist_item_deleted";
  const actor =
    event.actorId === currentUserId
      ? "You"
      : (event.actorId ?? "System / service");
  return (
    <li className="task-timeline-entry">
      <div className="task-timeline-heading">
        <strong>{eventLabels[event.eventType] ?? event.eventType}</strong>
        <Badge tone={mode === "Manual" ? "neutral" : "accent"}>{mode}</Badge>
      </div>
      <p className="task-timeline-meta">
        <span>{actor}</span>
        <span>Source: {event.source}</span>
        <time dateTime={event.occurredAt}>
          {new Date(event.occurredAt).toLocaleString()}
        </time>
      </p>
      {reason ? (
        <p className="task-event-reason">Reason: {reason}</p>
      ) : mode !== "Manual" ? (
        <p className="muted">No reason was supplied for this event.</p>
      ) : null}
      {redacted ? (
        <p className="muted">Original content is not shown in history.</p>
      ) : fieldChanges.length ? (
        <dl className="task-event-changes">
          {fieldChanges.map(([field, change]) =>
            record(change) ? (
              <div key={field}>
                <dt>{fieldLabels[field] ?? field}</dt>
                <dd>
                  <span>{display(change.from)}</span>
                  <span aria-label="changed to"> → </span>
                  <strong>{display(change.to)}</strong>
                </dd>
              </div>
            ) : null,
          )}
        </dl>
      ) : (
        <p className="muted">
          {typeof payload.from === "string" && typeof payload.to === "string"
            ? `${payload.from} → ${payload.to}`
            : "No field-change details were recorded."}
        </p>
      )}
      {event.correlationId ? (
        <small className="task-event-correlation">
          Correlation: {event.correlationId}
        </small>
      ) : null}
    </li>
  );
}

export function TaskTimeline({
  scope,
  currentUserId,
  repository,
}: {
  scope: TaskEventScope;
  currentUserId: string;
  repository?: TaskEventRepository;
}) {
  const { events, error, isLoading, reload } = useTaskEvents(scope, repository);
  return (
    <Card className="task-timeline" aria-label="Activity timeline">
      <CardHeader>
        <div className="task-card-heading">
          <CardTitle>Activity timeline</CardTitle>
          <Button
            disabled={isLoading}
            onClick={() => void reload()}
            size="sm"
            variant="secondary"
          >
            Refresh history
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p role="status">Loading activity…</p>
        ) : error ? (
          <p role="alert" className="auth-error">
            {error}
          </p>
        ) : events.length ? (
          <ol className="task-timeline-list" aria-label="Task history">
            {events.map((event) => (
              <TimelineEntry
                key={event.eventId}
                event={event}
                currentUserId={currentUserId}
              />
            ))}
          </ol>
        ) : (
          <p className="muted">
            No activity recorded yet. Earlier task changes may predate history
            recording.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
