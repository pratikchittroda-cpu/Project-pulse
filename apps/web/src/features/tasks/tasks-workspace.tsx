import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageLayout,
  PriorityBadge,
} from "@projectpulse/ui";

import { TaskForm } from "./task-form.js";
import {
  emptyTaskDraft,
  taskToDraft,
  type TaskRecord,
  type TaskRepository,
  type TaskScope,
} from "./task-repository.js";
import { useTasks } from "./use-tasks.js";

export function TasksWorkspace({
  scope,
  archivedProject = false,
  repository,
}: {
  scope: TaskScope;
  archivedProject?: boolean;
  repository?: TaskRepository;
}) {
  const [includeArchived, setIncludeArchived] = useState(false);
  const {
    tasks,
    options,
    isLoading,
    isSaving,
    error,
    reload,
    save,
    setArchived,
  } = useTasks(scope, includeArchived, repository);
  const [editor, setEditor] = useState<{ task?: TaskRecord } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const canWrite = options.canWrite && !archivedProject && !isLoading;

  async function archive(task: TaskRecord) {
    setMutationError(null);
    setMessage(null);
    try {
      const saved = await setArchived(task, !task.archivedAt);
      setMessage(`${saved.key} ${saved.archivedAt ? "archived" : "restored"}.`);
    } catch (cause) {
      setMutationError(
        cause instanceof Error
          ? cause.message
          : "Could not change task archive state.",
      );
    }
  }

  return (
    <PageLayout
      title="Tasks"
      eyebrow={`${scope.projectKey} planning`}
      description="Plan and assign work in the selected project."
      actions={
        canWrite ? (
          <Button
            disabled={isSaving}
            onClick={() => {
              setEditor({});
              setMessage(null);
              setMutationError(null);
            }}
          >
            New task
          </Button>
        ) : undefined
      }
    >
      {message ? (
        <p className="auth-success" role="status">
          {message}
        </p>
      ) : null}
      {error || mutationError ? (
        <p className="auth-error" role="alert">
          {error ?? mutationError}
        </p>
      ) : null}
      {!isLoading && !error && !canWrite ? (
        <p className="muted">
          {archivedProject
            ? "This project is archived. Tasks are read-only."
            : "You have read-only access to tasks in this project."}
        </p>
      ) : null}
      <div className="task-toolbar">
        <label className="task-archive-toggle">
          <input
            checked={includeArchived}
            disabled={isSaving}
            onChange={(event) => {
              setIncludeArchived(event.target.checked);
              setEditor(null);
            }}
            type="checkbox"
          />
          Show archived tasks
        </label>
        <Button
          disabled={isSaving || isLoading}
          onClick={() => {
            setEditor(null);
            void reload();
          }}
          size="sm"
          variant="secondary"
        >
          Reload tasks
        </Button>
      </div>
      {editor && canWrite ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {editor.task ? `Edit ${editor.task.key}` : "Create task"}
            </CardTitle>
            <CardDescription>
              Task keys are assigned automatically and stay stable after edits.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TaskForm
              key={editor.task?.id ?? "new"}
              initialDraft={
                editor.task
                  ? taskToDraft(editor.task)
                  : {
                      ...emptyTaskDraft,
                      status:
                        options.statuses.find(
                          ({ status }) => status === "backlog",
                        )?.status ??
                        options.statuses[0]?.status ??
                        "backlog",
                    }
              }
              isSaving={isSaving}
              onCancel={() => setEditor(null)}
              onSave={(draft) => save(draft, editor.task)}
              options={options}
              onSaved={(saved) => {
                setEditor(null);
                setMessage(`${saved.key} saved.`);
              }}
            />
          </CardContent>
        </Card>
      ) : null}
      {isLoading ? (
        <p className="muted" role="status">
          Loading tasks…
        </p>
      ) : null}
      {!isLoading && !error && tasks.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {includeArchived ? "No tasks yet" : "No active tasks"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="muted">
              {canWrite
                ? "Create a task to start planning work for this project."
                : "Tasks will appear here when a project contributor adds them."}
            </p>
          </CardContent>
        </Card>
      ) : null}
      {!isLoading ? (
        <ul aria-label="Project tasks" className="task-list">
          {tasks.map((task) => (
            <li key={task.id}>
              <Card>
                <CardHeader>
                  <div className="task-card-heading">
                    <div>
                      <p className="task-display-key">{task.key}</p>
                      <CardTitle>{task.title}</CardTitle>
                    </div>
                    <div className="project-actions">
                      <Badge
                        tone={
                          task.status === "completed" ? "success" : "neutral"
                        }
                      >
                        {options.statuses.find(
                          ({ status }) => status === task.status,
                        )?.label ?? task.status}
                      </Badge>
                      <PriorityBadge priority={task.priority} />
                      {task.archivedAt ? <Badge>Archived</Badge> : null}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {task.description ? (
                    <p className="task-description">{task.description}</p>
                  ) : null}
                  <dl className="task-metadata">
                    <div>
                      <dt>Assignee</dt>
                      <dd>{task.assigneeId ?? "Unassigned"}</dd>
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
                    <div aria-label="Labels" className="task-labels">
                      {task.labels.map((label) => (
                        <Badge key={label}>{label}</Badge>
                      ))}
                    </div>
                  ) : null}
                  {canWrite ? (
                    <div className="project-actions task-card-actions">
                      <Button
                        aria-label={`Edit ${task.key}`}
                        disabled={isSaving}
                        onClick={() => {
                          setEditor({ task });
                          setMutationError(null);
                          setMessage(null);
                        }}
                        size="sm"
                        variant="secondary"
                      >
                        Edit
                      </Button>
                      <Button
                        aria-label={`${task.archivedAt ? "Restore" : "Archive"} ${task.key}`}
                        disabled={isSaving}
                        onClick={() => void archive(task)}
                        size="sm"
                        variant={task.archivedAt ? "secondary" : "ghost"}
                      >
                        {task.archivedAt ? "Restore" : "Archive"}
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      ) : null}
    </PageLayout>
  );
}
