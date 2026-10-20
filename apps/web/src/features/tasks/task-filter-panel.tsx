import { useEffect, useState } from "react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from "@projectpulse/ui";

import type { TaskScope } from "./task-repository.js";
import {
  emptyTaskFilters,
  hasActiveTaskFilters,
  type TaskFilterOptions,
  type TaskFilters,
} from "./task-filters.js";
import {
  savedTaskViewRepository,
  type SavedTaskView,
  type SavedTaskViewRepository,
} from "./saved-view-repository.js";

const priorities = ["urgent", "high", "medium", "low"] as const;

export interface TaskFilterPanelProps {
  disabled?: boolean;
  filters: TaskFilters;
  onChange: (next: Partial<TaskFilters>) => void;
  onClear: () => void;
  options: TaskFilterOptions;
  savedViewRepository?: SavedTaskViewRepository;
  scope: TaskScope;
}

export function TaskFilterPanel({
  disabled = false,
  filters,
  onChange,
  onClear,
  options,
  savedViewRepository = savedTaskViewRepository,
  scope,
}: TaskFilterPanelProps) {
  return (
    <Card aria-label="Task filters" className="task-filter-card">
      <CardHeader>
        <div className="task-filter-heading">
          <div>
            <CardTitle>Search and filters</CardTitle>
            <CardDescription>
              Search keys, titles, descriptions, labels, and any connected
              branch or pull-request metadata.
            </CardDescription>
          </div>
          <Button
            disabled={disabled || !hasActiveTaskFilters(filters)}
            onClick={onClear}
            size="sm"
            variant="ghost"
          >
            Clear filters
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div aria-label="Task filter controls" className="task-filters">
          <Input
            disabled={disabled}
            label="Find tasks"
            onChange={(event) => onChange({ query: event.target.value })}
            placeholder="Key, title, description, label, branch, or PR"
            value={filters.query}
          />
          <FilterSelect
            disabled={disabled}
            label="Status"
            onChange={(value) => onChange({ status: value })}
            options={options.statuses.map(({ label, status }) => ({
              label,
              value: status,
            }))}
            value={filters.status}
          />
          <FilterSelect
            disabled={disabled}
            label="Priority"
            onChange={(value) =>
              onChange({ priority: value as TaskFilters["priority"] })
            }
            options={priorities.map((priority) => ({
              label: priority.charAt(0).toUpperCase() + priority.slice(1),
              value: priority,
            }))}
            value={filters.priority}
          />
          <FilterSelect
            disabled={disabled}
            label="Assignee"
            onChange={(value) => onChange({ assigneeId: value })}
            options={[
              { label: "Unassigned", value: "unassigned" },
              ...options.assignees.map(({ id, label }) => ({
                label: label ?? id,
                value: id,
              })),
            ]}
            value={filters.assigneeId}
          />
          <FilterSelect
            ariaLabel="Filter by sprint"
            disabled={disabled}
            label="Sprint"
            onChange={(value) => onChange({ sprintId: value })}
            options={[
              { label: "Backlog", value: "backlog" },
              ...options.sprints.map(({ id, label, status }) => ({
                label: status ? `${label} · ${status}` : label,
                value: id,
              })),
            ]}
            value={filters.sprintId}
          />
          <FilterSelect
            disabled={disabled}
            label="Team"
            onChange={(value) => onChange({ teamId: value })}
            options={[
              { label: "Unassigned", value: "unassigned" },
              ...options.teams.map(({ id, label }) => ({ label, value: id })),
            ]}
            value={filters.teamId}
          />
          <FilterSelect
            disabled={disabled}
            label="Label"
            onChange={(value) => onChange({ label: value })}
            options={options.labels.map((label) => ({
              label,
              value: label,
            }))}
            value={filters.label}
          />
          <label className="task-archive-toggle">
            <input
              checked={filters.includeArchived}
              disabled={disabled}
              onChange={(event) =>
                onChange({ includeArchived: event.target.checked })
              }
              type="checkbox"
            />
            Show archived tasks
          </label>
        </div>
        <SavedViewsPanel
          filters={filters}
          onApply={(next) => onChange(next)}
          repository={savedViewRepository}
          scope={scope}
        />
      </CardContent>
    </Card>
  );
}

function FilterSelect({
  ariaLabel,
  disabled,
  label,
  onChange,
  options,
  value,
}: {
  ariaLabel?: string;
  disabled: boolean;
  label: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
  value: string;
}) {
  return (
    <label className="field">
      <span className="pp-field-label">{label}</span>
      <select
        aria-label={ariaLabel ?? label}
        className="pp-input"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value={emptyTaskFilters.status}>
          {label === "Status"
            ? "All statuses"
            : label === "Priority"
              ? "All priorities"
              : label === "Assignee"
                ? "All assignees"
                : label === "Sprint"
                  ? "All sprints"
                  : label === "Team"
                    ? "All teams"
                    : "All labels"}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SavedViewsPanel({
  filters,
  onApply,
  repository,
  scope,
}: {
  filters: TaskFilters;
  onApply: (filters: TaskFilters) => void;
  repository: SavedTaskViewRepository;
  scope: TaskScope;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [views, setViews] = useState<SavedTaskView[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function reload() {
    setIsLoading(true);
    setError(null);
    try {
      setViews(await repository.list(scope));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not load saved views.",
      );
    } finally {
      setIsLoading(false);
      setHasLoaded(true);
    }
  }

  useEffect(() => {
    if (isOpen && !hasLoaded && !isLoading) {
      void reload();
    }
  }, [hasLoaded, isLoading, isOpen, scope]);

  async function createView(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Enter a name for the saved view.");
      return;
    }
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      await repository.create(scope, name, filters);
      setName("");
      setMessage("Saved view created.");
      await reload();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not create saved view.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function updateView(view: SavedTaskView) {
    if (!editingName.trim()) {
      setError("Enter a name for the saved view.");
      return;
    }
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      await repository.update(scope, view, editingName, filters);
      setEditingId(null);
      setEditingName("");
      setMessage("Saved view updated.");
      await reload();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not update saved view.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function removeView(view: SavedTaskView) {
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      await repository.remove(scope, view);
      setViews((current) => current.filter(({ id }) => id !== view.id));
      setMessage("Saved view deleted.");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not delete saved view.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="task-saved-views" aria-label="Saved task views">
      <button
        aria-expanded={isOpen}
        className="task-saved-views-toggle"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <span>Saved views</span>
        <span aria-hidden="true">{isOpen ? "−" : "+"}</span>
      </button>
      {isOpen ? (
        <div className="task-saved-views-content">
          <p className="muted">
            Save the current filters for this project. Views belong to your
            account and never expose tasks outside your project access.
          </p>
          {error ? (
            <div>
              <p className="auth-error" role="alert">
                {error}
              </p>
              <Button
                onClick={() => {
                  setHasLoaded(false);
                  void reload();
                }}
                size="sm"
                variant="secondary"
              >
                Reload saved views
              </Button>
            </div>
          ) : null}
          {message ? (
            <p className="auth-success" role="status">
              {message}
            </p>
          ) : null}
          <form
            aria-label="Save current task view"
            className="saved-view-form"
            onSubmit={(event) => void createView(event)}
          >
            <Input
              disabled={isSaving}
              label="View name"
              maxLength={120}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Ready for review"
              value={name}
            />
            <Button disabled={isSaving} size="sm" type="submit">
              Save current view
            </Button>
          </form>
          {isLoading ? (
            <p className="muted" role="status">
              Loading saved views…
            </p>
          ) : views.length ? (
            <ul aria-label="Saved task views" className="saved-view-list">
              {views.map((view) => (
                <li key={view.id}>
                  {editingId === view.id ? (
                    <Input
                      aria-label={`Name for ${view.name}`}
                      disabled={isSaving}
                      label="Edit view name"
                      maxLength={120}
                      onChange={(event) => setEditingName(event.target.value)}
                      value={editingName}
                    />
                  ) : (
                    <strong>{view.name}</strong>
                  )}
                  <div className="saved-view-actions">
                    <Button
                      disabled={isSaving}
                      onClick={() => onApply(view.filters)}
                      size="sm"
                      variant="secondary"
                    >
                      Apply
                    </Button>
                    {editingId === view.id ? (
                      <>
                        <Button
                          disabled={isSaving}
                          onClick={() => void updateView(view)}
                          size="sm"
                        >
                          Save changes
                        </Button>
                        <Button
                          disabled={isSaving}
                          onClick={() => {
                            setEditingId(null);
                            setEditingName("");
                          }}
                          size="sm"
                          variant="ghost"
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <Button
                        aria-label={`Edit saved view ${view.name}`}
                        disabled={isSaving}
                        onClick={() => {
                          setEditingId(view.id);
                          setEditingName(view.name);
                          setError(null);
                        }}
                        size="sm"
                        variant="ghost"
                      >
                        Edit
                      </Button>
                    )}
                    <Button
                      aria-label={`Delete saved view ${view.name}`}
                      disabled={isSaving}
                      onClick={() => void removeView(view)}
                      size="sm"
                      variant="danger"
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No saved views yet.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
