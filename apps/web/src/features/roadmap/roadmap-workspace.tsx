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
} from "@releasearc/ui";

import { taskDetailPath } from "../tasks/task-detail-repository.js";
import type {
  TaskRecord,
  TaskRepository,
  TaskScope,
} from "../tasks/task-repository.js";
import {
  isMilestoneOverdue,
  pointsLabel,
  progressForTasks,
} from "./roadmap-model.js";
import {
  type EpicDraft,
  type EpicRecord,
  type InitiativeDraft,
  type InitiativeRecord,
  type MilestoneDraft,
  type MilestoneRecord,
  type RoadmapRepository,
  type RoadmapStatus,
} from "./roadmap-repository.js";
import { useRoadmap } from "./use-roadmap.js";

interface RoadmapWorkspaceProps {
  archivedProject?: boolean;
  canAdministerOrganization?: boolean;
  roadmapStore?: RoadmapRepository;
  scope: TaskScope;
  taskStore?: TaskRepository;
}

const statusOptions: RoadmapStatus[] = [
  "planned",
  "active",
  "completed",
  "canceled",
];
const statusLabel: Record<RoadmapStatus, string> = {
  planned: "Planned",
  active: "Active",
  completed: "Completed",
  canceled: "Canceled",
};

export function RoadmapWorkspace(props: RoadmapWorkspaceProps) {
  const { organizationId, projectId, userId } = props.scope;
  return (
    <RoadmapContent
      key={`${organizationId}:${projectId}:${userId}`}
      {...props}
    />
  );
}

function RoadmapContent({
  archivedProject = false,
  canAdministerOrganization = false,
  roadmapStore,
  scope,
  taskStore,
}: RoadmapWorkspaceProps) {
  const roadmap = useRoadmap(scope, roadmapStore, taskStore);
  const {
    initiatives,
    epics,
    milestones,
    tasks,
    options,
    error,
    isLoading,
    isSaving,
    reload,
  } = roadmap;
  const [message, setMessage] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "overdue" | RoadmapStatus
  >("all");
  const [initiativeFilter, setInitiativeFilter] = useState("all");
  const [editingInitiative, setEditingInitiative] =
    useState<InitiativeRecord | null>(null);
  const [editingEpic, setEditingEpic] = useState<EpicRecord | null>(null);
  const [epicFormOpen, setEpicFormOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] =
    useState<MilestoneRecord | null>(null);
  const canWrite = Boolean(options?.canWrite) && !archivedProject && !isLoading;
  const canWriteInitiatives = canWrite && canAdministerOrganization;
  const terminalStatuses = useMemo(
    () =>
      new Set(
        (options?.statuses ?? [])
          .filter(({ isTerminal }) => isTerminal)
          .map(({ status }) => status),
      ),
    [options?.statuses],
  );

  const taskProgress = progressForTasks(tasks, terminalStatuses);
  const selectedInitiative =
    initiativeFilter === "all"
      ? null
      : (initiatives.find(({ id }) => id === initiativeFilter) ?? null);
  const visibleInitiatives = initiatives.filter((initiative) => {
    if (selectedInitiative && initiative.id !== selectedInitiative.id)
      return false;
    return statusFilter === "all" || statusFilter === "overdue"
      ? true
      : initiative.status === statusFilter;
  });
  const visibleEpics = epics.filter((epic) => {
    if (selectedInitiative && epic.initiativeId !== selectedInitiative.id)
      return false;
    return statusFilter === "all" || statusFilter === "overdue"
      ? true
      : epic.status === statusFilter;
  });
  const visibleMilestones = milestones.filter((milestone) => {
    if (statusFilter === "overdue")
      return isMilestoneOverdue(milestone.targetDate, milestone.status);
    return statusFilter === "all" || milestone.status === statusFilter;
  });
  async function save<T>(operation: () => Promise<T>, success: string) {
    setMessage(null);
    try {
      await operation();
      setMessage(success);
      return true;
    } catch {
      return false;
    }
  }

  return (
    <PageLayout
      title="Roadmap"
      eyebrow={`${scope.projectKey} planning hierarchy`}
      description="Connect initiatives, epics, milestones, and delivery tasks with explainable progress."
      actions={
        <div className="project-actions">
          <Link to="/app/backlog">Backlog</Link>
          <Link to="/app/tasks">Tasks</Link>
          <Button
            disabled={isLoading || isSaving}
            onClick={() => {
              setMessage(null);
              setEditingInitiative(null);
              setEditingEpic(null);
              setEditingMilestone(null);
              void reload();
            }}
            variant="secondary"
          >
            Reload roadmap
          </Button>
        </div>
      }
    >
      {message ? (
        <p className="auth-success" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}
      {isLoading ? (
        <p role="status">Loading roadmap…</p>
      ) : (
        <>
          {!canWrite ? (
            <p className="muted">
              {archivedProject
                ? "This project is archived. The roadmap is read-only."
                : "You have read-only access to this project's roadmap."}
            </p>
          ) : null}
          <div className="roadmap-summary-grid">
            <SummaryCard label="Initiatives" value={initiatives.length} />
            <SummaryCard label="Epics" value={epics.length} />
            <SummaryCard label="Milestones" value={milestones.length} />
            <SummaryCard
              label="Task progress"
              value={`${taskProgress.progressPercent}%`}
              detail={`${taskProgress.completedTaskCount}/${taskProgress.taskCount} active tasks`}
            />
            <SummaryCard
              label="Estimated progress"
              value={pointsLabel(taskProgress.completedPoints)}
              detail={`of ${pointsLabel(taskProgress.totalPoints)}`}
            />
          </div>
          <Card aria-label="Roadmap filters">
            <CardHeader>
              <CardTitle>Roadmap filters</CardTitle>
              <CardDescription>
                Progress counts terminal, non-canceled tasks. Unestimated tasks
                count toward task progress and contribute zero points.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="roadmap-filter-row">
                <label className="field">
                  <span className="pp-field-label">Status</span>
                  <select
                    aria-label="Roadmap status filter"
                    className="pp-input"
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(
                        event.target.value as "all" | "overdue" | RoadmapStatus,
                      )
                    }
                  >
                    <option value="all">All items</option>
                    <option value="overdue">Overdue milestones</option>
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {statusLabel[status]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="pp-field-label">Initiative</span>
                  <select
                    aria-label="Roadmap initiative filter"
                    className="pp-input"
                    value={initiativeFilter}
                    onChange={(event) =>
                      setInitiativeFilter(event.target.value)
                    }
                  >
                    <option value="all">All initiatives</option>
                    {initiatives.map((initiative) => (
                      <option key={initiative.id} value={initiative.id}>
                        {initiative.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </CardContent>
          </Card>
          {canWriteInitiatives ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  {editingInitiative
                    ? `Edit ${editingInitiative.name}`
                    : "Create an initiative"}
                </CardTitle>
                <CardDescription>
                  Initiatives are organization-level goals that can group epics
                  across projects.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <InitiativeForm
                  key={editingInitiative?.id ?? "new"}
                  disabled={isSaving}
                  item={editingInitiative}
                  onCancel={() => setEditingInitiative(null)}
                  onSave={async (draft) => {
                    const saved = await save(
                      () =>
                        roadmap.saveInitiative(
                          draft,
                          editingInitiative ?? undefined,
                        ),
                      editingInitiative
                        ? "Initiative updated."
                        : "Initiative created.",
                    );
                    if (saved) setEditingInitiative(null);
                  }}
                />
              </CardContent>
            </Card>
          ) : null}
          <Card aria-label="Initiatives and epics">
            <CardHeader>
              <CardTitle>Initiatives and epics</CardTitle>
              <CardDescription>
                Epics inherit the selected initiative relationship; task
                progress is calculated from the tasks linked to each epic.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {visibleInitiatives.length || visibleEpics.length ? (
                <div className="roadmap-hierarchy-list">
                  {visibleInitiatives.map((initiative) => {
                    const initiativeEpics = visibleEpics.filter(
                      ({ initiativeId }) => initiativeId === initiative.id,
                    );
                    const initiativeTasks = tasks.filter((task) =>
                      initiativeEpics.some(({ id }) => id === task.epicId),
                    );
                    return (
                      <InitiativeSection
                        canWrite={canWrite}
                        epics={initiativeEpics}
                        initiative={initiative}
                        initiativeTasks={initiativeTasks}
                        key={initiative.id}
                        onEdit={() => setEditingInitiative(initiative)}
                        onEditEpic={(item) => {
                          setEditingEpic(item);
                          setEpicFormOpen(true);
                        }}
                        scope={scope}
                        tasks={tasks}
                        terminalStatuses={terminalStatuses}
                      />
                    );
                  })}
                  {visibleEpics.some(
                    ({ initiativeId }) => initiativeId === null,
                  ) ? (
                    <InitiativeSection
                      canWrite={canWrite}
                      epics={visibleEpics.filter(
                        ({ initiativeId }) => initiativeId === null,
                      )}
                      initiative={null}
                      initiativeTasks={tasks.filter(
                        (task) => task.epicId === null,
                      )}
                      onEditEpic={(item) => {
                        setEditingEpic(item);
                        setEpicFormOpen(true);
                      }}
                      scope={scope}
                      tasks={tasks}
                      terminalStatuses={terminalStatuses}
                    />
                  ) : null}
                </div>
              ) : (
                <p className="muted">
                  No roadmap items match the current filters. Create an
                  initiative or epic to define the project path.
                </p>
              )}
              {canWrite ? (
                <Button
                  onClick={() => {
                    setEditingEpic(null);
                    setEpicFormOpen(true);
                  }}
                  size="sm"
                  variant="secondary"
                >
                  New epic
                </Button>
              ) : null}
              {canWrite && epicFormOpen ? (
                <EpicForm
                  key={editingEpic?.id ?? "new-epic"}
                  disabled={isSaving}
                  initiatives={initiatives}
                  item={editingEpic}
                  onCancel={() => {
                    setEditingEpic(null);
                    setEpicFormOpen(false);
                  }}
                  onSave={async (draft) => {
                    const saved = await save(
                      () => roadmap.saveEpic(draft, editingEpic ?? undefined),
                      editingEpic ? "Epic updated." : "Epic created.",
                    );
                    if (saved) {
                      setEditingEpic(null);
                      setEpicFormOpen(false);
                    }
                  }}
                />
              ) : null}
            </CardContent>
          </Card>
          <Card aria-label="Milestones">
            <CardHeader>
              <CardTitle>Milestones</CardTitle>
              <CardDescription>
                Milestone progress uses linked tasks. Overdue means the target
                date is before today and the milestone is not completed or
                canceled.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {visibleMilestones.length ? (
                <div className="roadmap-milestone-list">
                  {visibleMilestones.map((milestone) => {
                    const milestoneTasks = tasks.filter(
                      ({ milestoneId }) => milestoneId === milestone.id,
                    );
                    return (
                      <MilestoneSection
                        canWrite={canWrite}
                        key={milestone.id}
                        milestone={milestone}
                        onEdit={() => setEditingMilestone(milestone)}
                        tasks={milestoneTasks}
                        terminalStatuses={terminalStatuses}
                      />
                    );
                  })}
                </div>
              ) : (
                <p className="muted">
                  No milestones match the current filters.
                </p>
              )}
              {canWrite ? (
                <MilestoneForm
                  key={editingMilestone?.id ?? "new-milestone"}
                  disabled={isSaving}
                  item={editingMilestone}
                  onCancel={() => setEditingMilestone(null)}
                  onSave={async (draft) => {
                    const saved = await save(
                      () =>
                        roadmap.saveMilestone(
                          draft,
                          editingMilestone ?? undefined,
                        ),
                      editingMilestone
                        ? "Milestone updated."
                        : "Milestone created.",
                    );
                    if (saved) setEditingMilestone(null);
                  }}
                />
              ) : null}
            </CardContent>
          </Card>
          <Card aria-label="Task hierarchy">
            <CardHeader>
              <CardTitle>Task hierarchy</CardTitle>
              <CardDescription>
                Link active tasks to an epic and milestone. Every change remains
                a normal atomic task-history event.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tasks.length ? (
                <div className="roadmap-task-list">
                  {tasks.map((task) => (
                    <TaskHierarchyRow
                      disabled={!canWrite || isSaving}
                      epics={epics}
                      key={`${task.id}:${task.updatedAt}`}
                      milestones={milestones}
                      onSave={async (epicId, milestoneId) => {
                        setMessage(null);
                        try {
                          await roadmap.updateTaskHierarchy(
                            task,
                            epicId,
                            milestoneId,
                          );
                          setMessage(`${task.key} hierarchy updated.`);
                        } catch {
                          /* The hook exposes the actionable error. */
                        }
                      }}
                      scope={scope}
                      task={task}
                    />
                  ))}
                </div>
              ) : (
                <p className="muted">No active tasks are available to link.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </PageLayout>
  );
}

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <Card>
      <CardContent>
        <div className="roadmap-summary-label">{label}</div>
        <div className="roadmap-summary-value">{value}</div>
        {detail ? <div className="roadmap-summary-detail">{detail}</div> : null}
      </CardContent>
    </Card>
  );
}

function InitiativeSection({
  canWrite,
  epics,
  initiative,
  initiativeTasks,
  onEdit,
  onEditEpic,
  scope,
  tasks,
  terminalStatuses,
}: {
  canWrite: boolean;
  epics: EpicRecord[];
  initiative: InitiativeRecord | null;
  initiativeTasks: TaskRecord[];
  onEdit?: () => void;
  onEditEpic: (item: EpicRecord) => void;
  scope: TaskScope;
  tasks: TaskRecord[];
  terminalStatuses: Set<string>;
}) {
  const progress = progressForTasks(initiativeTasks, terminalStatuses);
  return (
    <section
      className="roadmap-initiative-section"
      aria-label={initiative?.name ?? "Unassigned epics"}
    >
      <div className="roadmap-section-heading">
        <div>
          <div className="roadmap-title-row">
            <h3>{initiative?.name ?? "Unassigned epics"}</h3>
            {initiative ? <StatusBadge status={initiative.status} /> : null}
          </div>
          <p className="muted">
            {initiative?.description ||
              "Epics in this project without an initiative."}
          </p>
        </div>
        {initiative && canWrite ? (
          <Button onClick={onEdit} size="sm" variant="secondary">
            Edit initiative
          </Button>
        ) : null}
      </div>
      {initiative ? <ProgressLine progress={progress} /> : null}
      {epics.length ? (
        <div className="roadmap-epic-list">
          {epics.map((epic) => {
            const epicTasks = tasks.filter(({ epicId }) => epicId === epic.id);
            return (
              <article className="roadmap-epic" key={epic.id}>
                <div className="roadmap-section-heading">
                  <div>
                    <div className="roadmap-title-row">
                      <h4>{epic.title}</h4>
                      <StatusBadge status={epic.status} />
                    </div>
                    <p className="muted">
                      {epic.description || "No epic description."}
                    </p>
                  </div>
                  {canWrite ? (
                    <Button
                      onClick={() => onEditEpic(epic)}
                      size="sm"
                      variant="secondary"
                    >
                      Edit epic
                    </Button>
                  ) : null}
                </div>
                <ProgressLine
                  progress={progressForTasks(epicTasks, terminalStatuses)}
                />
                {epicTasks.length ? (
                  <ul className="roadmap-linked-task-list">
                    {epicTasks.map((task) => (
                      <li key={task.id}>
                        <Link to={taskDetailPath(scope, task.id)}>
                          {task.key}
                        </Link>
                        <span>{task.title}</span>
                        <Badge>{task.status}</Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">No tasks linked to this epic yet.</p>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <p className="muted">
          No epics in this initiative for the selected project.
        </p>
      )}
    </section>
  );
}

function MilestoneSection({
  canWrite,
  milestone,
  onEdit,
  tasks,
  terminalStatuses,
}: {
  canWrite: boolean;
  milestone: MilestoneRecord;
  onEdit: () => void;
  tasks: TaskRecord[];
  terminalStatuses: Set<string>;
}) {
  const overdue = isMilestoneOverdue(milestone.targetDate, milestone.status);
  return (
    <article className="roadmap-milestone">
      <div className="roadmap-section-heading">
        <div>
          <div className="roadmap-title-row">
            <h3>{milestone.name}</h3>
            <StatusBadge status={milestone.status} />
            {overdue ? <Badge tone="danger">Overdue</Badge> : null}
          </div>
          <p className="muted">
            Target date: {milestone.targetDate ?? "No target date"}
          </p>
        </div>
        {canWrite ? (
          <Button onClick={onEdit} size="sm" variant="secondary">
            Edit milestone
          </Button>
        ) : null}
      </div>
      <ProgressLine progress={progressForTasks(tasks, terminalStatuses)} />
    </article>
  );
}

function ProgressLine({
  progress,
}: {
  progress: ReturnType<typeof progressForTasks>;
}) {
  return (
    <div
      className="roadmap-progress"
      aria-label={`${progress.progressPercent}% complete`}
    >
      <div className="roadmap-progress-heading">
        <strong>{progress.progressPercent}% complete</strong>
        <span>
          {progress.completedTaskCount}/{progress.taskCount} active tasks ·{" "}
          {pointsLabel(progress.completedPoints)} of{" "}
          {pointsLabel(progress.totalPoints)}
        </span>
      </div>
      <div className="roadmap-progress-track" aria-hidden="true">
        <span style={{ width: `${progress.progressPercent}%` }} />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: RoadmapStatus }) {
  return (
    <Badge
      tone={
        status === "completed"
          ? "success"
          : status === "active"
            ? "accent"
            : "neutral"
      }
    >
      {statusLabel[status]}
    </Badge>
  );
}

function InitiativeForm({
  disabled,
  item,
  onCancel,
  onSave,
}: {
  disabled: boolean;
  item: InitiativeRecord | null;
  onCancel: () => void;
  onSave: (draft: InitiativeDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<InitiativeDraft>({
    name: item?.name ?? "",
    description: item?.description ?? "",
    status: item?.status ?? "planned",
  });
  return (
    <form
      className="roadmap-form"
      onSubmit={(event) => {
        event.preventDefault();
        void onSave(draft);
      }}
    >
      <Input
        label="Initiative name"
        maxLength={200}
        disabled={disabled}
        required
        value={draft.name}
        onChange={(event) => setDraft({ ...draft, name: event.target.value })}
      />
      <label className="field">
        <span className="pp-field-label">Description</span>
        <textarea
          className="pp-input"
          disabled={disabled}
          value={draft.description}
          onChange={(event) =>
            setDraft({ ...draft, description: event.target.value })
          }
        />
      </label>
      <StatusSelect
        disabled={disabled}
        label="Initiative status"
        value={draft.status}
        onChange={(status) => setDraft({ ...draft, status })}
      />
      <FormButtons
        disabled={disabled}
        editing={Boolean(item)}
        onCancel={onCancel}
      />
    </form>
  );
}

function EpicForm({
  disabled,
  initiatives,
  item,
  onCancel,
  onSave,
}: {
  disabled: boolean;
  initiatives: InitiativeRecord[];
  item: EpicRecord | null;
  onCancel: () => void;
  onSave: (draft: EpicDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<EpicDraft>({
    title: item?.title ?? "",
    description: item?.description ?? "",
    initiativeId: item?.initiativeId ?? null,
    status: item?.status ?? "planned",
  });
  return (
    <form
      className="roadmap-form"
      onSubmit={(event) => {
        event.preventDefault();
        void onSave(draft);
      }}
    >
      <Input
        label="Epic title"
        maxLength={240}
        disabled={disabled}
        required
        value={draft.title}
        onChange={(event) => setDraft({ ...draft, title: event.target.value })}
      />
      <label className="field">
        <span className="pp-field-label">Initiative</span>
        <select
          className="pp-input"
          disabled={disabled}
          value={draft.initiativeId ?? ""}
          onChange={(event) =>
            setDraft({ ...draft, initiativeId: event.target.value || null })
          }
        >
          <option value="">No initiative</option>
          {initiatives.map((initiative) => (
            <option key={initiative.id} value={initiative.id}>
              {initiative.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="pp-field-label">Description</span>
        <textarea
          className="pp-input"
          disabled={disabled}
          value={draft.description}
          onChange={(event) =>
            setDraft({ ...draft, description: event.target.value })
          }
        />
      </label>
      <StatusSelect
        disabled={disabled}
        label="Epic status"
        value={draft.status}
        onChange={(status) => setDraft({ ...draft, status })}
      />
      <FormButtons
        disabled={disabled}
        editing={Boolean(item)}
        onCancel={onCancel}
      />
    </form>
  );
}

function MilestoneForm({
  disabled,
  item,
  onCancel,
  onSave,
}: {
  disabled: boolean;
  item: MilestoneRecord | null;
  onCancel: () => void;
  onSave: (draft: MilestoneDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<MilestoneDraft>({
    name: item?.name ?? "",
    targetDate: item?.targetDate ?? "",
    status: item?.status ?? "planned",
  });
  return (
    <form
      className="roadmap-form"
      onSubmit={(event) => {
        event.preventDefault();
        void onSave(draft);
      }}
    >
      <Input
        label="Milestone name"
        maxLength={200}
        disabled={disabled}
        required
        value={draft.name}
        onChange={(event) => setDraft({ ...draft, name: event.target.value })}
      />
      <div className="form-row">
        <Input
          label="Target date"
          type="date"
          disabled={disabled}
          value={draft.targetDate}
          onChange={(event) =>
            setDraft({ ...draft, targetDate: event.target.value })
          }
        />
        <StatusSelect
          disabled={disabled}
          label="Milestone status"
          value={draft.status}
          onChange={(status) => setDraft({ ...draft, status })}
        />
      </div>
      <FormButtons
        disabled={disabled}
        editing={Boolean(item)}
        onCancel={onCancel}
      />
    </form>
  );
}

function StatusSelect({
  disabled,
  label,
  value,
  onChange,
}: {
  disabled: boolean;
  label: string;
  value: RoadmapStatus;
  onChange: (status: RoadmapStatus) => void;
}) {
  return (
    <label className="field">
      <span className="pp-field-label">{label}</span>
      <select
        aria-label={label}
        className="pp-input"
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value as RoadmapStatus)}
      >
        {statusOptions.map((status) => (
          <option key={status} value={status}>
            {statusLabel[status]}
          </option>
        ))}
      </select>
    </label>
  );
}

function FormButtons({
  disabled,
  editing,
  onCancel,
}: {
  disabled: boolean;
  editing: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="project-actions">
      <Button disabled={disabled} type="submit">
        {editing ? "Save changes" : "Create"}
      </Button>
      {editing ? (
        <Button
          disabled={disabled}
          onClick={onCancel}
          type="button"
          variant="secondary"
        >
          Close editor
        </Button>
      ) : null}
    </div>
  );
}

function TaskHierarchyRow({
  disabled,
  epics,
  milestones,
  onSave,
  scope,
  task,
}: {
  disabled: boolean;
  epics: EpicRecord[];
  milestones: MilestoneRecord[];
  onSave: (epicId: string | null, milestoneId: string | null) => Promise<void>;
  scope: TaskScope;
  task: TaskRecord;
}) {
  const [epicId, setEpicId] = useState(task.epicId ?? "");
  const [milestoneId, setMilestoneId] = useState(task.milestoneId ?? "");
  return (
    <form
      className="roadmap-task-row"
      aria-label={`Link ${task.key}`}
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        void onSave(epicId || null, milestoneId || null).catch(() => undefined);
      }}
    >
      <div className="roadmap-task-title">
        <Link to={taskDetailPath(scope, task.id)}>{task.key}</Link>
        <strong>{task.title}</strong>
        <span className="muted">{task.status}</span>
      </div>
      <label className="field">
        <span className="pp-field-label">Epic</span>
        <select
          aria-label={`Epic for ${task.key}`}
          className="pp-input"
          disabled={disabled}
          value={epicId}
          onChange={(event) => setEpicId(event.target.value)}
        >
          <option value="">No epic</option>
          {epics.map((epic) => (
            <option key={epic.id} value={epic.id}>
              {epic.title}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="pp-field-label">Milestone</span>
        <select
          aria-label={`Milestone for ${task.key}`}
          className="pp-input"
          disabled={disabled}
          value={milestoneId}
          onChange={(event) => setMilestoneId(event.target.value)}
        >
          <option value="">No milestone</option>
          {milestones.map((milestone) => (
            <option key={milestone.id} value={milestone.id}>
              {milestone.name}
            </option>
          ))}
        </select>
      </label>
      <Button disabled={disabled} size="sm" type="submit">
        Save links
      </Button>
    </form>
  );
}
