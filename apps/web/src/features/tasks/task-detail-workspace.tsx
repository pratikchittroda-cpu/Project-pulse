import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Link } from "react-router-dom";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  PageLayout,
  PriorityBadge,
} from "@projectpulse/ui";
import { TaskTimeline } from "../events/task-timeline.js";
import type { TaskEventRepository } from "../events/task-events-repository.js";
import { TaskCollaborationPanel } from "./task-collaboration-panel.js";
import type { TaskCollaborationRepository } from "./task-collaboration-repository.js";
import { TaskForm } from "./task-form.js";
import { taskToDraft, type TaskScope } from "./task-repository.js";
import type {
  TaskDependencyDraft,
  TaskDependencyState,
  TaskRelationRecord,
} from "./task-relations-repository.js";
import {
  taskDetailRepository,
  taskDetailPath,
  type TaskDetail,
  type TaskDetailAddress,
  type TaskDetailRepository,
} from "./task-detail-repository.js";

interface TaskDetailWorkspaceProps {
  address: TaskDetailAddress;
  repository?: TaskDetailRepository;
  eventsRepository?: TaskEventRepository;
  collaborationRepository?: TaskCollaborationRepository;
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
  collaborationRepository,
}: TaskDetailWorkspaceProps) {
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [collaborationVersion, setCollaborationVersion] = useState(0);
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
  const dependencies = detail.dependencies ?? emptyDependencyState();
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

  async function createDependency(draft: TaskDependencyDraft) {
    if (busy.current || !repository.createDependency) return;
    busy.current = true;
    setSaving(true);
    setMessage(null);
    setMutationError(null);
    try {
      await repository.createDependency(scope, draft);
      if (mounted.current) {
        setMessage("Dependency added.");
        await load();
      }
    } catch (cause) {
      if (mounted.current)
        setMutationError(
          cause instanceof Error ? cause.message : "Could not add dependency.",
        );
    } finally {
      busy.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  async function removeDependency(relation: TaskRelationRecord) {
    if (busy.current || !repository.removeDependency) return;
    busy.current = true;
    setSaving(true);
    setMessage(null);
    setMutationError(null);
    try {
      await repository.removeDependency(scope, relation);
      if (mounted.current) {
        setMessage("Dependency removed.");
        await load();
      }
    } catch (cause) {
      if (mounted.current)
        setMutationError(
          cause instanceof Error
            ? cause.message
            : "Could not remove dependency.",
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
      <DependencyPanel
        canWrite={canWrite && Boolean(repository.createDependency)}
        disabled={saving}
        onCreate={(draft) => void createDependency(draft)}
        onRemove={(relation) => void removeDependency(relation)}
        scope={scope}
        state={dependencies}
        task={task}
      />
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
        key={`${task.id}:${task.updatedAt}:${collaborationVersion}`}
        scope={{ organizationId, projectId, taskId }}
        currentUserId={userId}
        repository={eventsRepository}
      />
      {collaborationRepository ? (
        <TaskCollaborationPanel
          canWrite={canWrite}
          onChanged={() => setCollaborationVersion((version) => version + 1)}
          projectArchived={detail.projectArchived}
          repository={collaborationRepository}
          scope={scope}
          taskId={task.id}
        />
      ) : null}
    </PageLayout>
  );
}

function emptyDependencyState(): TaskDependencyState {
  return { blockers: [], blocking: [], availableTasks: [] };
}

function DependencyPanel({
  canWrite,
  disabled,
  onCreate,
  onRemove,
  scope,
  state,
  task,
}: {
  canWrite: boolean;
  disabled: boolean;
  onCreate: (draft: TaskDependencyDraft) => void;
  onRemove: (relation: TaskRelationRecord) => void;
  scope: Pick<TaskScope, "organizationId" | "projectId">;
  state: TaskDependencyState;
  task: TaskDetail["task"];
}) {
  const [direction, setDirection] = useState<"blocked_by" | "blocks">(
    "blocked_by",
  );
  const [otherTaskId, setOtherTaskId] = useState("");
  const [explanation, setExplanation] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!otherTaskId || !explanation.trim()) return;
    onCreate({
      blockerTaskId: direction === "blocked_by" ? otherTaskId : task.id,
      blockedTaskId: direction === "blocked_by" ? task.id : otherTaskId,
      explanation,
      targetDate,
    });
    setOtherTaskId("");
    setExplanation("");
    setTargetDate("");
  };
  const relationRow = (
    relation: TaskRelationRecord,
    side: "blocker" | "blocked",
  ) => {
    const other =
      side === "blocker" ? relation.blockerTask : relation.blockedTask;
    const otherId =
      side === "blocker" ? relation.blockerTaskId : relation.blockedTaskId;
    return (
      <li className="task-dependency-item" key={relation.id}>
        <div>
          {other ? (
            <Link to={taskDetailPath(scope, other.id)}>
              {other.key} · {other.title}
            </Link>
          ) : (
            <span>{otherId} · unavailable</span>
          )}
          <p>{relation.explanation || "No explanation provided."}</p>
          {relation.targetDate ? (
            <small>Target date: {relation.targetDate}</small>
          ) : null}
        </div>
        {canWrite ? (
          <Button
            disabled={disabled}
            onClick={() => onRemove(relation)}
            size="sm"
            variant="ghost"
          >
            Remove dependency
          </Button>
        ) : null}
      </li>
    );
  };
  return (
    <Card aria-label="Task dependencies">
      <CardHeader>
        <div className="task-dependency-heading">
          <div>
            <CardTitle>Dependencies</CardTitle>
            <p className="muted">
              {state.blockers.length
                ? `${state.blockers.length} blocker${state.blockers.length === 1 ? "" : "s"} currently affect this task.`
                : "No blockers currently affect this task."}
            </p>
          </div>
          {state.blockers.length &&
          (task.priority === "urgent" || task.priority === "high") ? (
            <Badge tone="danger">Critical task blocked</Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        <div className="task-dependency-sections">
          <section aria-label="Blocked by">
            <h3>Blocked by</h3>
            {state.blockers.length ? (
              <ul className="task-dependency-list">
                {state.blockers.map((relation) =>
                  relationRow(relation, "blocker"),
                )}
              </ul>
            ) : (
              <p className="muted">No blocking tasks.</p>
            )}
          </section>
          <section aria-label="Blocks">
            <h3>Blocks</h3>
            {state.blocking.length ? (
              <ul className="task-dependency-list">
                {state.blocking.map((relation) =>
                  relationRow(relation, "blocked"),
                )}
              </ul>
            ) : (
              <p className="muted">This task is not blocking other work.</p>
            )}
          </section>
        </div>
        {canWrite ? (
          <form className="task-dependency-form" onSubmit={submit}>
            <h3>Add dependency</h3>
            <label className="field">
              <span className="pp-field-label">Relationship</span>
              <select
                className="pp-input"
                disabled={disabled}
                value={direction}
                onChange={(event) =>
                  setDirection(event.target.value as "blocked_by" | "blocks")
                }
              >
                <option value="blocked_by">This task is blocked by…</option>
                <option value="blocks">This task blocks…</option>
              </select>
            </label>
            <label className="field">
              <span className="pp-field-label">Task</span>
              <select
                aria-label="Dependency task"
                className="pp-input"
                disabled={disabled}
                required
                value={otherTaskId}
                onChange={(event) => setOtherTaskId(event.target.value)}
              >
                <option value="">Choose a task</option>
                {state.availableTasks.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.key} · {candidate.title}
                  </option>
                ))}
              </select>
            </label>
            <Input
              disabled={disabled}
              label="Blocker explanation"
              maxLength={2000}
              required
              value={explanation}
              onChange={(event) => setExplanation(event.target.value)}
            />
            <Input
              disabled={disabled}
              label="Target date (optional)"
              type="date"
              value={targetDate}
              onChange={(event) => setTargetDate(event.target.value)}
            />
            <Button
              disabled={disabled || !otherTaskId || !explanation.trim()}
              type="submit"
            >
              Add dependency
            </Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
