import { useState, type FormEvent } from "react";
import {
  DEFAULT_TASK_PRIORITIES,
  type TaskPriority,
} from "@projectpulse/domain";
import { Button, Input } from "@projectpulse/ui";

import {
  TaskValidationError,
  type TaskDraft,
  type TaskFieldErrors,
  type TaskOptions,
  type TaskRecord,
} from "./task-repository.js";

interface TaskFormProps {
  initialDraft: TaskDraft;
  isSaving: boolean;
  onCancel: () => void;
  onSave: (draft: TaskDraft) => Promise<TaskRecord>;
  onSaved: (task: TaskRecord) => void;
  options: TaskOptions;
}

export function TaskForm({
  initialDraft,
  isSaving,
  onCancel,
  onSave,
  onSaved,
  options,
}: TaskFormProps) {
  const [draft, setDraft] = useState(initialDraft);
  const [fields, setFields] = useState<TaskFieldErrors>({});
  const [error, setError] = useState<string | null>(null);

  function change<K extends keyof TaskDraft>(field: K, value: TaskDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
    setFields((current) => ({ ...current, [field]: undefined }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFields({});
    try {
      const saved = await onSave(draft);
      onSaved(saved);
    } catch (cause) {
      if (cause instanceof TaskValidationError) setFields(cause.fields);
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save the task. Try again.",
      );
    }
  }

  return (
    <form
      className="task-form"
      noValidate
      onSubmit={(event) => void submit(event)}
    >
      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}
      <fieldset className="task-form-fields" disabled={isSaving}>
        <legend className="visually-hidden">Task fields</legend>
        <Input
          autoFocus
          error={fields.title}
          label="Title"
          maxLength={240}
          onChange={(event) => change("title", event.target.value)}
          required
          value={draft.title}
        />
        <label className="field">
          <span className="pp-field-label">Description</span>
          <textarea
            className="pp-input project-description"
            onChange={(event) => change("description", event.target.value)}
            value={draft.description}
          />
        </label>
        <div className="form-row">
          <label className="field">
            <span className="pp-field-label">Status</span>
            <select
              aria-invalid={Boolean(fields.status)}
              aria-describedby={fields.status ? "task-status-error" : undefined}
              className="pp-input"
              onChange={(event) => change("status", event.target.value)}
              value={draft.status}
            >
              {options.statuses.map(({ label, status }) => (
                <option key={status} value={status}>
                  {label}
                </option>
              ))}
            </select>
            {fields.status ? (
              <span className="pp-field-error" id="task-status-error">
                {fields.status}
              </span>
            ) : null}
          </label>
          <label className="field">
            <span className="pp-field-label">Priority</span>
            <select
              className="pp-input"
              onChange={(event) =>
                change("priority", event.target.value as TaskPriority)
              }
              value={draft.priority}
            >
              {DEFAULT_TASK_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="field">
          <span className="pp-field-label">Assignee</span>
          <select
            className="pp-input"
            onChange={(event) => change("assigneeId", event.target.value)}
            value={draft.assigneeId}
          >
            <option value="">Unassigned</option>
            {draft.assigneeId &&
            !options.assignees.some(({ id }) => id === draft.assigneeId) ? (
              <option value={draft.assigneeId}>
                Unavailable member · {draft.assigneeId}
              </option>
            ) : null}
            {options.assignees.map(({ id }) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
        <Input
          error={fields.labels}
          hint="Comma-separated; up to 20 labels of 40 characters each"
          label="Labels"
          onChange={(event) => change("labels", event.target.value)}
          value={draft.labels}
        />
        <div className="form-row">
          <Input
            error={fields.estimate}
            label="Estimate (story points)"
            min="0"
            max="99999999.99"
            step="0.01"
            type="number"
            onChange={(event) => change("estimate", event.target.value)}
            value={draft.estimate}
          />
          <Input
            error={fields.dueDate}
            label="Due date"
            type="date"
            onChange={(event) => change("dueDate", event.target.value)}
            value={draft.dueDate}
          />
        </div>
      </fieldset>
      <div className="project-actions">
        <Button disabled={isSaving} type="submit">
          {isSaving ? "Saving task…" : "Save task"}
        </Button>
        <Button disabled={isSaving} onClick={onCancel} variant="secondary">
          Cancel
        </Button>
      </div>
    </form>
  );
}
