import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  PageLayout,
  PriorityBadge,
} from "@projectpulse/ui";
import { taskDetailPath } from "../tasks/task-detail-repository.js";
import {
  buildTaskFilterOptions,
  filterTaskRecords,
} from "../tasks/task-filters.js";
import { TaskFilterPanel } from "../tasks/task-filter-panel.js";
import {
  savedTaskViewRepository,
  type SavedTaskViewRepository,
} from "../tasks/saved-view-repository.js";
import type {
  TaskRecord,
  TaskRepository,
  TaskScope,
} from "../tasks/task-repository.js";
import type {
  CycleAction,
  CycleDraft,
  CycleRecord,
  CycleRepository,
  CycleTaskSnapshot,
} from "./cycle-repository.js";
import { usePlanning } from "./use-planning.js";
import { useTaskFilters } from "../tasks/use-task-filters.js";

interface BacklogProps {
  archivedProject?: boolean;
  cycleStore?: CycleRepository;
  scope: TaskScope;
  savedViewRepository?: SavedTaskViewRepository;
  taskStore?: TaskRepository;
}
const isClosed = (cycle: CycleRecord) =>
  cycle.status === "completed" || cycle.status === "canceled";
const points = (value: number | null) =>
  value === null
    ? "Not captured"
    : `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} pts`;
const dateLabel = (value: string | null) => value?.slice(0, 10) ?? "No date";

export function BacklogWorkspace(props: BacklogProps) {
  const { organizationId, projectId, userId } = props.scope;
  return (
    <BacklogContent
      key={`${organizationId}:${projectId}:${userId}`}
      {...props}
    />
  );
}

function BacklogContent({
  archivedProject = false,
  cycleStore,
  savedViewRepository,
  scope,
  taskStore,
}: BacklogProps) {
  const planning = usePlanning(scope, cycleStore, taskStore);
  const { cycles, tasks, options, isLoading, isSaving, error, reload } =
    planning;
  const { clearFilters, filters, setFilters } = useTaskFilters();
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<CycleRecord | null>(null);
  const canWrite = Boolean(options?.canWrite) && !archivedProject && !isLoading;
  const openCycles = cycles.filter((cycle) => !isClosed(cycle));
  const openIds = new Set(openCycles.map(({ id }) => id));
  const filterOptions = useMemo(
    () =>
      buildTaskFilterOptions(
        tasks,
        options ?? { assignees: [], canWrite: false, statuses: [] },
        {
          sprints: cycles.map((cycle) => ({
            id: cycle.id,
            label: cycle.name,
            status: cycle.status,
          })),
        },
      ),
    [cycles, options, tasks],
  );
  const filteredTasks = useMemo(
    () => filterTaskRecords(tasks, filters),
    [filters, tasks],
  );
  const backlogTasks = filterTaskRecords(tasks, {
    ...filters,
    sprintId: "all",
  }).filter(({ cycleId }) => cycleId === null);
  const plannedTasks = filteredTasks.filter(
    ({ cycleId }) => cycleId && openIds.has(cycleId),
  );
  const active = cycles.find(({ status }) => status === "active");

  async function lifecycle(action: CycleAction, cycle: CycleRecord) {
    if (!canWrite || isSaving) return;
    setMessage(null);
    try {
      await planning.manageCycle(action, cycle);
      setEditing(null);
      const label = {
        start: cycle.status === "paused" ? "resumed" : "started",
        pause: "paused",
        complete: "completed",
        cancel: "canceled",
      }[action];
      setMessage(`${cycle.name} ${label}.`);
    } catch {
      /* The hook exposes errors without changing saved state. */
    }
  }

  const taskRow = (task: TaskRecord) => (
    <PlanningTaskRow
      key={`${task.id}:${task.updatedAt}`}
      task={task}
      scope={scope}
      cycles={openCycles}
      disabled={!canWrite || isSaving}
      onSave={async (cycleId, estimate) => {
        setMessage(null);
        await planning.updatePlan(task, cycleId, estimate);
        setMessage(`${task.key} planning updated.`);
      }}
    />
  );

  return (
    <PageLayout
      title="Backlog and sprints"
      eyebrow={`${scope.projectKey} planning`}
      description="Plan work, preserve the initial commitment, and carry unfinished tasks into the next sprint."
      actions={
        <div className="project-actions">
          <Link to="/app/tasks">Task list</Link>
          <Link to="/app/board">Board</Link>
          <Button
            disabled={isLoading || isSaving}
            variant="secondary"
            onClick={() => {
              setMessage(null);
              setEditing(null);
              void reload();
            }}
          >
            Reload planning
          </Button>
        </div>
      }
    >
      {message ? (
        <p role="status" className="auth-success">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="auth-error">
          {error}
        </p>
      ) : null}
      {isLoading ? (
        <p role="status">Loading backlog and sprints…</p>
      ) : (
        <>
          {!canWrite && !error ? (
            <p className="muted">
              {archivedProject
                ? "This project is archived. Planning is read-only."
                : "You have read-only access to planning."}
            </p>
          ) : null}
          <TaskFilterPanel
            disabled={isSaving}
            filters={filters}
            onChange={(next) => setFilters(next)}
            onClear={clearFilters}
            options={filterOptions}
            savedViewRepository={savedViewRepository ?? savedTaskViewRepository}
            scope={scope}
          />
          <div className="planning-overview-grid">
            <Card aria-label="Current sprint">
              <CardHeader>
                <CardTitle>Current sprint</CardTitle>
                <CardDescription>
                  One sprint may be active at a time. Pausing releases that
                  active slot.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {active ? (
                  <>
                    <h3>{active.name}</h3>
                    <CycleMetrics cycle={active} />
                  </>
                ) : (
                  <p className="muted">
                    No active sprint. Start a planned sprint when the team is
                    ready.
                  </p>
                )}
              </CardContent>
            </Card>
            {canWrite ? (
              <Card>
                <CardHeader>
                  <CardTitle>
                    {editing ? `Edit ${editing.name}` : "Create a sprint"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CycleForm
                    key={editing?.id ?? "new"}
                    cycle={editing}
                    disabled={isSaving}
                    onCancel={() => setEditing(null)}
                    onSave={async (draft) => {
                      setMessage(null);
                      await planning.saveCycle(draft, editing ?? undefined);
                      setEditing(null);
                      setMessage(
                        editing ? "Sprint updated." : "Sprint created.",
                      );
                    }}
                  />
                </CardContent>
              </Card>
            ) : null}
          </div>
          <Card aria-label="Sprint history">
            <CardHeader>
              <CardTitle>Sprints and history</CardTitle>
              <CardDescription>
                Commitment is captured at first start. Completion freezes task
                details, totals, and unfinished work.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="cycle-list">
                {cycles.length ? (
                  cycles.map((cycle) => (
                    <section
                      className="cycle-history-item"
                      aria-label={cycle.name}
                      key={cycle.id}
                    >
                      <div className="cycle-row">
                        <div>
                          <div className="cycle-row-heading">
                            <h3>{cycle.name}</h3>
                            <Badge
                              tone={
                                cycle.status === "active"
                                  ? "success"
                                  : cycle.status === "paused"
                                    ? "warning"
                                    : "neutral"
                              }
                            >
                              {cycle.status}
                            </Badge>
                          </div>
                          <p>
                            {dateLabel(cycle.startsAt)} →{" "}
                            {dateLabel(cycle.endsAt)}
                          </p>
                        </div>
                        {canWrite && !isClosed(cycle) ? (
                          <div className="project-actions">
                            <Button
                              disabled={isSaving}
                              size="sm"
                              variant="secondary"
                              onClick={() => setEditing(cycle)}
                            >
                              Edit sprint
                            </Button>
                            {cycle.status === "planned" ||
                            cycle.status === "paused" ? (
                              <Button
                                disabled={isSaving || Boolean(active)}
                                size="sm"
                                onClick={() => void lifecycle("start", cycle)}
                              >
                                {cycle.status === "paused" ? "Resume" : "Start"}
                              </Button>
                            ) : null}
                            {cycle.status === "active" ? (
                              <Button
                                disabled={isSaving}
                                size="sm"
                                onClick={() => void lifecycle("pause", cycle)}
                              >
                                Pause
                              </Button>
                            ) : null}
                            {cycle.startedAt ? (
                              <Button
                                disabled={isSaving}
                                size="sm"
                                onClick={() =>
                                  void lifecycle("complete", cycle)
                                }
                              >
                                Complete
                              </Button>
                            ) : null}
                            {cycle.status !== "active" ? (
                              <Button
                                disabled={isSaving}
                                variant="ghost"
                                size="sm"
                                onClick={() => void lifecycle("cancel", cycle)}
                              >
                                Cancel sprint
                              </Button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                      <CycleMetrics cycle={cycle} />
                      <details className="cycle-snapshot">
                        <summary>
                          Initial commitment · {cycle.initialTasks.length} tasks
                        </summary>
                        <SnapshotTasks
                          tasks={cycle.initialTasks}
                          scope={scope}
                        />
                      </details>
                      {isClosed(cycle) ? (
                        <details className="cycle-snapshot">
                          <summary>
                            Closed sprint history ·{" "}
                            {cycle.completionTasks.length} tasks
                          </summary>
                          <p className="muted">
                            Historical values stay fixed. Carry over work first,
                            then edit its estimate or status in the backlog or
                            next sprint.
                          </p>
                          <SnapshotTasks
                            tasks={cycle.completionTasks}
                            scope={scope}
                          />
                          {canWrite
                            ? cycle.completionTasks
                                .filter((snapshot) => !snapshot.terminal)
                                .map((snapshot) => {
                                  const task = tasks.find(
                                    ({ id, cycleId }) =>
                                      id === snapshot.id &&
                                      cycleId === cycle.id,
                                  );
                                  return task ? (
                                    <CarryoverTask
                                      key={task.id}
                                      task={task}
                                      cycles={openCycles}
                                      disabled={isSaving}
                                      onSave={async (destination) => {
                                        setMessage(null);
                                        await planning.updatePlan(
                                          task,
                                          destination,
                                          task.estimate,
                                        );
                                        setMessage(`${task.key} carried over.`);
                                      }}
                                    />
                                  ) : (
                                    <p key={snapshot.id}>
                                      {snapshot.key} · Already moved or
                                      unavailable
                                    </p>
                                  );
                                })
                            : null}
                        </details>
                      ) : null}
                    </section>
                  ))
                ) : (
                  <p className="muted">
                    No sprints yet. Create one to start planning.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
          <Card aria-label="Backlog tasks">
            <CardHeader>
              <CardTitle>Backlog tasks</CardTitle>
              <CardDescription>
                {backlogTasks.length} tasks without a sprint. Unestimated work
                counts as a task and contributes zero points.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="backlog-task-list">
                {backlogTasks.length ? (
                  backlogTasks.map(taskRow)
                ) : (
                  <p className="muted">
                    No active tasks in the backlog. Create tasks from the task
                    list or carry over unfinished sprint work.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
          <Card aria-label="Planned work">
            <CardHeader>
              <CardTitle>Planned work</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="backlog-task-list">
                {plannedTasks.length ? (
                  plannedTasks.map(taskRow)
                ) : (
                  <p className="muted">No work in this sprint selection.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </PageLayout>
  );
}

function CycleMetrics({ cycle }: { cycle: CycleRecord }) {
  return (
    <dl className="cycle-metrics">
      <div>
        <dt>Initial commitment</dt>
        <dd>{points(cycle.initialCommitment)}</dd>
      </div>
      <div>
        <dt>{isClosed(cycle) ? "Scope at close" : "Current scope"}</dt>
        <dd>
          {points(cycle.committedPoints)} · {cycle.taskCount} tasks
        </dd>
      </div>
      <div>
        <dt>Completed</dt>
        <dd>
          {points(cycle.completedPoints)} · {cycle.completedTaskCount} tasks
        </dd>
      </div>
      <div>
        <dt>Added since start</dt>
        <dd>
          {points(cycle.addedPoints)} · {cycle.addedTaskCount} tasks
        </dd>
      </div>
      <div>
        <dt>Removed since start</dt>
        <dd>
          {points(cycle.removedPoints)} · {cycle.removedTaskCount} tasks
        </dd>
      </div>
      {isClosed(cycle) ? (
        <div>
          <dt>Unfinished at close</dt>
          <dd>
            {points(cycle.carriedOverPoints)} · {cycle.carriedOverTaskCount}{" "}
            tasks
          </dd>
        </div>
      ) : null}
    </dl>
  );
}

function SnapshotTasks({
  tasks,
  scope,
}: {
  tasks: CycleTaskSnapshot[];
  scope: TaskScope;
}) {
  return tasks.length ? (
    <ul className="cycle-snapshot-list">
      {tasks.map((task) => (
        <li key={task.id}>
          <Link to={taskDetailPath(scope, task.id)}>
            {task.key} · {task.title}
          </Link>
          <span>
            {task.status} ·{" "}
            {task.estimate === null ? "Unestimated" : points(task.estimate)}
          </span>
        </li>
      ))}
    </ul>
  ) : (
    <p className="muted">No task snapshot recorded.</p>
  );
}

function CycleForm({
  cycle,
  disabled,
  onCancel,
  onSave,
}: {
  cycle: CycleRecord | null;
  disabled: boolean;
  onCancel: () => void;
  onSave: (draft: CycleDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<CycleDraft>({
    name: cycle?.name ?? "",
    startsAt: cycle?.startsAt?.slice(0, 10) ?? "",
    endsAt: cycle?.endsAt?.slice(0, 10) ?? "",
  });
  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await onSave(draft);
    } catch {
      /* Page alert keeps the draft available for retry. */
    }
  }
  return (
    <form className="cycle-form" onSubmit={(event) => void submit(event)}>
      <Input
        disabled={disabled}
        label="Sprint name"
        maxLength={160}
        required
        value={draft.name}
        onChange={(event) => setDraft({ ...draft, name: event.target.value })}
      />
      <div className="form-row">
        <Input
          disabled={disabled}
          label="Starts"
          type="date"
          value={draft.startsAt}
          onChange={(event) =>
            setDraft({ ...draft, startsAt: event.target.value })
          }
        />
        <Input
          disabled={disabled}
          label="Ends"
          type="date"
          value={draft.endsAt}
          onChange={(event) =>
            setDraft({ ...draft, endsAt: event.target.value })
          }
        />
      </div>
      <div className="project-actions">
        <Button disabled={disabled} type="submit">
          {cycle ? "Save sprint" : "Create sprint"}
        </Button>
        {cycle ? (
          <Button disabled={disabled} variant="secondary" onClick={onCancel}>
            Close editor
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function PlanningTaskRow({
  task,
  scope,
  cycles,
  disabled,
  onSave,
}: {
  task: TaskRecord;
  scope: TaskScope;
  cycles: CycleRecord[];
  disabled: boolean;
  onSave: (cycleId: string | null, estimate: number | null) => Promise<void>;
}) {
  const [cycleId, setCycleId] = useState(task.cycleId ?? "");
  const [estimate, setEstimate] = useState(
    task.estimate === null ? "" : String(task.estimate),
  );
  return (
    <form
      className="planning-task-row"
      aria-label={`Plan ${task.key}`}
      onSubmit={(event) => {
        event.preventDefault();
        void onSave(
          cycleId || null,
          estimate === "" ? null : Number(estimate),
        ).catch(() => undefined);
      }}
    >
      <div className="planning-task-main">
        <p className="task-display-key">{task.key}</p>
        <Link to={taskDetailPath(scope, task.id)}>
          <strong>{task.title}</strong>
        </Link>
        <div className="planning-task-badges">
          <PriorityBadge priority={task.priority} />
          <Badge>{task.status}</Badge>
        </div>
      </div>
      <div className="planning-task-controls">
        <SprintSelect
          label={`Sprint for ${task.key}`}
          value={cycleId}
          onChange={setCycleId}
          cycles={cycles}
          disabled={disabled}
        />
        <Input
          aria-label={`Estimate for ${task.key}`}
          disabled={disabled}
          label="Estimate"
          min="0"
          max="99999999.99"
          step="0.01"
          type="number"
          value={estimate}
          onChange={(event) => setEstimate(event.target.value)}
        />
        <Button disabled={disabled} type="submit" size="sm">
          Save plan
        </Button>
      </div>
    </form>
  );
}

function SprintSelect({
  label,
  value,
  onChange,
  cycles,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  cycles: CycleRecord[];
  disabled: boolean;
}) {
  return (
    <label className="field">
      <span className="pp-field-label">Sprint</span>
      <select
        className="pp-input"
        aria-label={label}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Backlog</option>
        {cycles.map((cycle) => (
          <option key={cycle.id} value={cycle.id}>
            {cycle.name} · {cycle.status}
          </option>
        ))}
      </select>
    </label>
  );
}

function CarryoverTask({
  task,
  cycles,
  disabled,
  onSave,
}: {
  task: TaskRecord;
  cycles: CycleRecord[];
  disabled: boolean;
  onSave: (id: string | null) => Promise<void>;
}) {
  const [destination, setDestination] = useState("");
  return (
    <form
      className="cycle-carryover"
      aria-label={`Carry over ${task.key}`}
      onSubmit={(event) => {
        event.preventDefault();
        void onSave(destination || null).catch(() => undefined);
      }}
    >
      <strong>{task.key}</strong>
      <SprintSelect
        label={`Carryover destination for ${task.key}`}
        value={destination}
        onChange={setDestination}
        cycles={cycles}
        disabled={disabled}
      />
      <Button disabled={disabled} type="submit">
        Carry over
      </Button>
    </form>
  );
}
