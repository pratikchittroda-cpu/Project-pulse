// @vitest-environment jsdom

import React, { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { TaskFilterPanel } from "../apps/web/src/features/tasks/task-filter-panel.js";
import {
  emptyTaskFilters,
  type TaskFilterOptions,
  type TaskFilters,
} from "../apps/web/src/features/tasks/task-filters.js";
import type {
  SavedTaskView,
  SavedTaskViewRepository,
} from "../apps/web/src/features/tasks/saved-view-repository.js";

const scope = {
  organizationId: "org-1",
  projectId: "project-1",
  projectKey: "PULSE",
  userId: "user-1",
};

const options: TaskFilterOptions = {
  assignees: [{ id: "user-1" }],
  labels: ["release"],
  sprints: [],
  statuses: [{ label: "In progress", status: "in_progress" }],
  teams: [],
};

function view(id: string, name: string, filters = emptyTaskFilters) {
  return {
    createdAt: "2026-10-21T00:00:00.000Z",
    filters,
    id,
    name,
    updatedAt: "2026-10-21T00:00:00.000Z",
  } satisfies SavedTaskView;
}

describe("saved task views", () => {
  it("creates, reads back, applies, edits, and deletes a named view", async () => {
    let views: SavedTaskView[] = [];
    const repository: SavedTaskViewRepository = {
      create: vi.fn(async (_scope, name, filters) => {
        const saved = view("view-1", name, filters);
        views = [...views, saved];
        return saved;
      }),
      list: vi.fn(async () => views),
      remove: vi.fn(async (_scope, selected) => {
        views = views.filter(({ id }) => id !== selected.id);
      }),
      update: vi.fn(async (_scope, selected, name, filters) => {
        const saved = view(selected.id, name, filters);
        views = views.map((current) =>
          current.id === selected.id ? saved : current,
        );
        return saved;
      }),
    };

    function Harness() {
      const [filters, setFilters] = useState<TaskFilters>({
        ...emptyTaskFilters,
        priority: "high",
      });
      return (
        <MemoryRouter>
          <TaskFilterPanel
            filters={filters}
            onChange={(next) =>
              setFilters((current) => ({ ...current, ...next }))
            }
            onClear={() => setFilters(emptyTaskFilters)}
            options={options}
            savedViewRepository={repository}
            scope={scope}
          />
        </MemoryRouter>
      );
    }

    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: /Saved views/ }));
    await screen.findByText("No saved views yet.");
    fireEvent.change(screen.getByLabelText("View name"), {
      target: { value: "Release queue" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save current view" }));
    await screen.findByText("Release queue");
    expect(repository.create).toHaveBeenCalledWith(
      scope,
      "Release queue",
      expect.objectContaining({ priority: "high" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(repository.create).toHaveBeenLastCalledWith(
      scope,
      "Release queue",
      expect.objectContaining({ priority: "high" }),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Edit saved view Release queue" }),
    );
    fireEvent.change(screen.getByLabelText("Name for Release queue"), {
      target: { value: "Ready queue" },
    });
    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "in_progress" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByText("Ready queue");
    expect(repository.update).toHaveBeenCalledWith(
      scope,
      expect.objectContaining({ id: "view-1" }),
      "Ready queue",
      expect.objectContaining({ status: "in_progress" }),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Delete saved view Ready queue" }),
    );
    await waitFor(() => expect(screen.queryByText("Ready queue")).toBeNull());
    expect(repository.remove).toHaveBeenCalledWith(
      scope,
      expect.objectContaining({ id: "view-1" }),
    );
  });
});
