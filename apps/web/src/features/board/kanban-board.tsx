import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Badge,
  Button,
  Card,
  CardContent,
  PageLayout,
  PriorityBadge,
} from "@projectpulse/ui";
import type { TaskPriority } from "@projectpulse/domain";

import { taskDetailPath } from "../tasks/task-detail-repository.js";
import {
  buildTaskFilterOptions,
  filterTaskRecords,
  type TaskFilters,
} from "../tasks/task-filters.js";
import { TaskFilterPanel } from "../tasks/task-filter-panel.js";
import {
  savedTaskViewRepository,
  type SavedTaskViewRepository,
} from "../tasks/saved-view-repository.js";
import type {
  TaskOptions,
  TaskRecord,
  TaskRepository,
  TaskScope,
} from "../tasks/task-repository.js";
import {
  taskDependencyRepository,
  type TaskRelationRepository,
  type TaskDependencySummary,
} from "../tasks/task-relations-repository.js";
import { useTaskFilters } from "../tasks/use-task-filters.js";
import { useKanbanBoard } from "./use-kanban-board.js";

export interface BoardFilters {
  assigneeId: string;
  priority: TaskPriority | "all";
  query: string;
  sprintId?: string;
  status?: string;
  teamId?: string;
  label?: string;
}

export interface KanbanColumnModel {
  isTerminal?: boolean;
  label: string;
  status: string;
  tasks: TaskRecord[];
}

function statusLabel(status: string) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function buildKanbanColumns(
  tasks: TaskRecord[],
  statuses: TaskOptions["statuses"],
): KanbanColumnModel[] {
  const knownStatuses = new Set(statuses.map(({ status }) => status));
  const definitions: TaskOptions["statuses"] = [
    ...statuses,
    ...[...new Set(tasks.map(({ status }) => status))]
      .filter((status) => !knownStatuses.has(status))
      .map((status) => ({ label: statusLabel(status), status })),
  ];

  return definitions.map((definition) => ({
    isTerminal: definition.isTerminal,
    label: definition.label,
    status: definition.status,
    tasks: tasks.filter((task) => task.status === definition.status),
  }));
}

export function filterKanbanTasks(
  tasks: TaskRecord[],
  filters: BoardFilters,
): TaskRecord[] {
  return filterTaskRecords(tasks, filters as Partial<TaskFilters>);
}

function statusTone(status: string) {
  if (status === "completed" || status === "ready_to_merge")
    return "success" as const;
  if (status === "blocked") return "danger" as const;
  if (status === "in_progress") return "accent" as const;
  if (status === "in_review" || status === "changes_requested")
    return "warning" as const;
  return "neutral" as const;
}

function taskMatchesStatus(task: TaskRecord, status: string) {
  return task.status === status;
}

function KanbanCard({
  canWrite,
  isMoving,
  onDragEnd,
  onDragStart,
  onMove,
  options,
  scope,
  task,
  dependency,
}: {
  canWrite: boolean;
  isMoving: boolean;
  onDragEnd: () => void;
  onDragStart: (taskId: string, event: React.DragEvent<HTMLElement>) => void;
  onMove: (task: TaskRecord, status: string) => void;
  options: TaskOptions;
  scope: TaskScope;
  task: TaskRecord;
  dependency?: TaskDependencySummary;
}) {
  const draggable = canWrite && !task.archivedAt && !isMoving;
  const status = options.statuses.find(({ status }) => status === task.status);

  return (
    <article
      className={`kanban-card${task.archivedAt ? " kanban-card-archived" : ""}`}
      draggable={draggable}
      onDragEnd={onDragEnd}
      onDragStart={(event) => onDragStart(task.id, event)}
      role="listitem"
    >
      <div className="kanban-card-heading">
        <div>
          <p className="task-display-key">{task.key}</p>
          <h3 className="kanban-card-title">
            <Link to={taskDetailPath(scope, task.id)}>{task.title}</Link>
          </h3>
        </div>
        <Badge tone={statusTone(task.status)}>
          {status?.label ?? statusLabel(task.status)}
        </Badge>
      </div>
      <div className="kanban-card-badges">
        <PriorityBadge priority={task.priority} />
        {task.archivedAt ? <Badge>Archived</Badge> : null}
        {dependency?.blockerCount ? (
          <Badge tone={dependency.hasCriticalBlocker ? "danger" : "warning"}>
            {dependency.blockerCount} blocker
            {dependency.blockerCount === 1 ? "" : "s"}
          </Badge>
        ) : null}
        {dependency?.blockingCount ? (
          <Badge tone="accent">Blocking {dependency.blockingCount}</Badge>
        ) : null}
      </div>
      <dl className="kanban-card-metadata">
        <div>
          <dt>Assignee</dt>
          <dd>{task.assigneeId ?? "Unassigned"}</dd>
        </div>
        <div>
          <dt>Estimate</dt>
          <dd>{task.estimate === null ? "—" : `${task.estimate} pts`}</dd>
        </div>
      </dl>
      {task.labels.length ? (
        <div aria-label={`${task.key} labels`} className="task-labels">
          {task.labels.map((label) => (
            <Badge key={label}>{label}</Badge>
          ))}
        </div>
      ) : null}
      <details className="kanban-card-details">
        <summary>More details</summary>
        <p>{task.description || "No description yet."}</p>
        <p>
          <strong>Due:</strong> {task.dueDate ?? "No due date"}
        </p>
      </details>
      <label className="kanban-move-control">
        <span>Move</span>
        <select
          aria-label={`Move ${task.key}`}
          disabled={!canWrite || Boolean(task.archivedAt) || isMoving}
          onChange={(event) => onMove(task, event.target.value)}
          value={task.status}
        >
          {options.statuses.map(({ label, status }) => (
            <option key={status} value={status}>
              {label}
            </option>
          ))}
        </select>
      </label>
    </article>
  );
}

export function KanbanBoard({
  archivedProject = false,
  dependencyRepository,
  repository,
  savedViewRepository,
  scope,
}: {
  archivedProject?: boolean;
  dependencyRepository?: TaskRelationRepository;
  repository?: TaskRepository;
  savedViewRepository?: SavedTaskViewRepository;
  scope: TaskScope;
}) {
  const { clearFilters, filters, setFilters } = useTaskFilters();
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const {
    error,
    isLoading,
    isMoving,
    moveTask,
    movingTaskId,
    options,
    reload,
    tasks,
    dependencySummary,
  } = useKanbanBoard(
    scope,
    filters.includeArchived,
    repository,
    dependencyRepository ?? (repository ? null : taskDependencyRepository),
  );
  const canWrite = options.canWrite && !archivedProject && !isLoading;
  const filterOptions = useMemo(
    () => buildTaskFilterOptions(tasks, options),
    [options, tasks],
  );
  const filteredTasks = useMemo(
    () => filterKanbanTasks(tasks, filters),
    [filters, tasks],
  );
  const columns = useMemo(
    () => buildKanbanColumns(filteredTasks, options.statuses),
    [filteredTasks, options.statuses],
  );

  async function move(task: TaskRecord, nextStatus: string) {
    setMutationError(null);
    try {
      await moveTask(task, nextStatus);
    } catch (cause) {
      setMutationError(
        cause instanceof Error ? cause.message : "Could not move task.",
      );
    }
  }

  function startDrag(taskId: string, event: React.DragEvent<HTMLElement>) {
    if (!canWrite) return;
    setDraggingTaskId(taskId);
    event.dataTransfer?.setData("text/plain", taskId);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  }

  function dropOn(status: string, event: React.DragEvent<HTMLElement>) {
    event.preventDefault();
    const taskId = event.dataTransfer?.getData("text/plain") || draggingTaskId;
    const task = tasks.find(({ id }) => id === taskId);
    setDragOverStatus(null);
    setDraggingTaskId(null);
    if (task && taskMatchesStatus(task, status) === false)
      void move(task, status);
  }

  function resetFilters() {
    clearFilters();
  }

  return (
    <PageLayout
      actions={
        <div className="project-actions">
          <Link
            className="button button-secondary button-small"
            to="/app/tasks"
          >
            List view
          </Link>
          <Button
            disabled={isLoading || isMoving}
            onClick={() => void reload()}
            size="sm"
            variant="secondary"
          >
            Reload board
          </Button>
        </div>
      }
      description="Move work through the configured workflow and keep delivery state visible."
      eyebrow={`${scope.projectKey} flow`}
      title="Kanban board"
    >
      {mutationError || error ? (
        <p className="auth-error" role="alert">
          {mutationError ?? error}
        </p>
      ) : null}
      {!isLoading && !canWrite ? (
        <p className="muted">
          {archivedProject
            ? "This project is archived. The board is read-only."
            : "You have read-only access to this board."}
        </p>
      ) : null}
      <TaskFilterPanel
        disabled={isLoading || isMoving}
        filters={filters}
        onChange={(next) => setFilters(next)}
        onClear={resetFilters}
        options={filterOptions}
        savedViewRepository={savedViewRepository ?? savedTaskViewRepository}
        scope={scope}
      />
      <div className="kanban-summary" aria-live="polite">
        <strong>{filteredTasks.length}</strong> of {tasks.length} tasks shown{" "}
        <span>·</span>{" "}
        {canWrite
          ? "Drag cards or use Move with the keyboard."
          : "Read-only board."}
      </div>
      {isLoading ? (
        <p className="muted" role="status">
          Loading board…
        </p>
      ) : null}
      {!isLoading && !error && columns.length === 0 ? (
        <Card>
          <CardContent>
            <p className="muted">
              No workflow statuses are configured for this project.
            </p>
          </CardContent>
        </Card>
      ) : null}
      {!isLoading && !error && columns.length > 0 ? (
        <div aria-label="Kanban board" className="kanban-board">
          {columns.map((column) => {
            const wipCount = column.tasks.filter(
              (task) => !task.archivedAt,
            ).length;
            const headingId = `kanban-column-${column.status}`;
            return (
              <section
                aria-labelledby={headingId}
                className={`kanban-column${dragOverStatus === column.status ? " kanban-column-drop-target" : ""}`}
                key={column.status}
                onDragEnter={() => canWrite && setDragOverStatus(column.status)}
                onDragLeave={(event) => {
                  if (event.currentTarget === event.target)
                    setDragOverStatus(null);
                }}
                onDragOver={(event) => {
                  if (canWrite) event.preventDefault();
                }}
                onDrop={(event) => dropOn(column.status, event)}
              >
                <header className="kanban-column-header">
                  <div>
                    <h2 id={headingId}>{column.label}</h2>
                    <p>
                      {column.tasks.length}{" "}
                      {column.tasks.length === 1 ? "task" : "tasks"}
                    </p>
                  </div>
                  <Badge
                    tone={wipCount > 0 ? "accent" : "neutral"}
                    aria-label={`${wipCount} work in progress tasks; no configured limit`}
                  >
                    WIP {wipCount} · no limit
                  </Badge>
                </header>
                <div
                  aria-label={`${column.label} tasks`}
                  className="kanban-column-list"
                  role="list"
                >
                  {column.tasks.length ? (
                    column.tasks.map((task) => (
                      <KanbanCard
                        canWrite={canWrite}
                        isMoving={isMoving || movingTaskId === task.id}
                        key={task.id}
                        onDragEnd={() => {
                          setDraggingTaskId(null);
                          setDragOverStatus(null);
                        }}
                        onDragStart={startDrag}
                        onMove={(current, status) => void move(current, status)}
                        options={options}
                        scope={scope}
                        task={task}
                        dependency={dependencySummary[task.id]}
                      />
                    ))
                  ) : (
                    <p className="kanban-empty-column">Drop a task here</p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      ) : null}
    </PageLayout>
  );
}
