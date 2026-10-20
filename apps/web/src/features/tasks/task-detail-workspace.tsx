import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageLayout,
  PriorityBadge,
} from "@projectpulse/ui";
import { TaskTimeline } from "../events/task-timeline.js";
import type { TaskEventRepository } from "../events/task-events-repository.js";
import { TaskForm } from "./task-form.js";
import { taskToDraft } from "./task-repository.js";
import {
  taskDetailRepository,
  type TaskDetail,
  type TaskDetailAddress,
  type TaskDetailRepository,
} from "./task-detail-repository.js";

interface TaskDetailWorkspaceProps {
  address: TaskDetailAddress;
  repository?: TaskDetailRepository;
  eventsRepository?: TaskEventRepository;
}

export function TaskDetailWorkspace(props: TaskDetailWorkspaceProps) {
  const { organizationId, projectId, taskId, userId } = props.address;
  return (
    <TaskDetailContent
      key={`${organizationId}:${projectId}:${taskId}:${userId}`}
      {...props}
    />
  );
}

function TaskDetailContent({
  address,
  repository = taskDetailRepository,
  eventsRepository,
}: TaskDetailWorkspaceProps) {
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const generation = useRef(0);
  const mounted = useRef(false);
  const busy = useRef(false);
  const { organizationId, projectId, taskId, userId } = address;
  const load = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    setError(null);
    setMutationError(null);
    setDetail(null);
    setEditing(false);
    try {
      const result = await repository.load({
        organizationId,
        projectId,
        taskId,
        userId,
      });
      if (generation.current === request) setDetail(result);
    } catch (cause) {
      if (generation.current === request)
        setError(
          cause instanceof Error ? cause.message : "Could not load task.",
        );
    } finally {
      if (generation.current === request) setLoading(false);
    }
  }, [repository, organizationId, projectId, taskId, userId]);
  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
      generation.current += 1;
    };
  }, [load]);

  if (loading) return <p role="status">Loading task…</p>;
  if (error)
    return (
      <PageLayout title="Task unavailable">
        <p role="alert" className="auth-error">
          {error}
        </p>
        <Button onClick={() => void load()}>Retry loading task</Button>
      </PageLayout>
    );
  if (!detail)
    return (
      <PageLayout
        title="Task not found or access denied"
        description="This task is unavailable in the requested project."
      >
        <Link to="/app/tasks">Back to tasks</Link>
      </PageLayout>
    );

  const { task, scope, options } = detail;
  const canWrite = options.canWrite && !detail.projectArchived;
  async function archive() {
    if (busy.current || !detail) return;
    busy.current = true;
    setSaving(true);
    setMessage(null);
    setMutationError(null);
    try {
      await repository.setArchived(
        detail.scope,
        detail.task,
        !detail.task.archivedAt,
      );
      if (mounted.current) {
        setMessage(
          detail.task.archivedAt ? "Task restored." : "Task archived.",
        );
        await load();
      }
    } catch (cause) {
      if (mounted.current)
        setMutationError(
          cause instanceof Error
            ? cause.message
            : "Could not change archive state.",
        );
    } finally {
      busy.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  return (
    <PageLayout
      title={task.title}
      eyebrow={`${detail.projectName} · ${task.key}`}
      actions={
        <div className="project-actions">
          <Link to="/app/tasks">Back to tasks</Link>
          <Button
            disabled={saving}
            onClick={() => {
              setMessage(null);
              void load();
            }}
            variant="secondary"
          >
            Reload task
          </Button>
          {canWrite ? (
            <>
              <Button
                disabled={saving}
                onClick={() => {
                  setEditing(!editing);
                  setMessage(null);
                  setMutationError(null);
                }}
                variant="secondary"
              >
                {editing ? "Close editor" : "Edit task"}
              </Button>
              <Button
                disabled={saving}
                onClick={() => void archive()}
                variant="secondary"
              >
                {task.archivedAt ? "Restore task" : "Archive task"}
              </Button>
            </>
          ) : null}
        </div>
      }
    >
      {message ? <p role="status">{message}</p> : null}
      {mutationError ? (
        <p role="alert" className="auth-error">
          {mutationError}
        </p>
      ) : null}
      {!canWrite ? (
        <p className="muted">
          {detail.projectArchived
            ? "This project is archived. Tasks are read-only."
            : "You have read-only access to this task."}
        </p>
      ) : null}
      <div className="task-detail-grid">
        <Card aria-label="Task details">
          <CardHeader>
            <div className="project-actions">
              <Badge tone={task.status === "completed" ? "success" : "neutral"}>
                {options.statuses.find(({ status }) => status === task.status)
                  ?.label ?? task.status}
              </Badge>
              <PriorityBadge priority={task.priority} />
              {task.archivedAt ? <Badge>Archived</Badge> : null}
            </div>
          </CardHeader>
          <CardContent>
            <p className="task-description">
              {task.description || "No description yet."}
            </p>
            <dl className="task-detail-metadata">
              <div>
                <dt>Task key</dt>
                <dd>{task.key}</dd>
              </div>
              <div>
                <dt>Assignee</dt>
                <dd>
                  {task.assigneeId === userId
                    ? "You"
                    : (task.assigneeId ?? "Unassigned")}
                </dd>
              </div>
              <div>
                <dt>Sprint</dt>
                <dd>
                  {detail.cycleName ??
                    (task.cycleId
                      ? "Sprint unavailable"
                      : "No sprint assigned")}
                </dd>
              </div>
              <div>
                <dt>Estimate</dt>
                <dd>
                  {task.estimate === null
                    ? "Not estimated"
                    : `${task.estimate} points`}
                </dd>
              </div>
              <div>
                <dt>Due date</dt>
                <dd>{task.dueDate ?? "No due date"}</dd>
              </div>
            </dl>
            {task.labels.length ? (
              <div aria-label="Task labels" className="task-labels">
                {task.labels.map((label) => (
                  <Badge key={label}>{label}</Badge>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
        <Card aria-label="Engineering links">
          <CardHeader>
            <CardTitle>Engineering links</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="task-detail-metadata">
              {[
                "Branch",
                "Commit",
                "Pull request",
                "CI checks",
                "Deployment",
              ].map((name) => (
                <div key={name}>
                  <dt>{name}</dt>
                  <dd>Not linked yet</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>
      {editing && canWrite ? (
        <Card>
          <CardHeader>
            <CardTitle>Edit {task.key}</CardTitle>
          </CardHeader>
          <CardContent>
            <TaskForm
              initialDraft={taskToDraft(task)}
              options={options}
              isSaving={saving}
              onCancel={() => setEditing(false)}
              onSave={async (draft) => {
                if (busy.current)
                  throw new Error("A change is already being saved.");
                busy.current = true;
                setSaving(true);
                try {
                  return await repository.save(scope, draft, task);
                } finally {
                  busy.current = false;
                  if (mounted.current) setSaving(false);
                }
              }}
              onSaved={() => {
                if (mounted.current) {
                  setMessage("Task saved.");
                  void load();
                }
              }}
            />
          </CardContent>
        </Card>
      ) : null}
      <TaskTimeline
        key={`${task.id}:${task.updatedAt}`}
        scope={{ organizationId, projectId, taskId }}
        currentUserId={userId}
        repository={eventsRepository}
      />
    </PageLayout>
  );
}
