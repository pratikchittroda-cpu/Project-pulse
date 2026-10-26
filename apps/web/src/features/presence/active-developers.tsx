import { useCallback, useSyncExternalStore } from "react";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@releasearc/ui";

import type {
  ActiveDeveloperPresence,
  DeveloperPresenceController,
  DeveloperPresenceSnapshot,
} from "./developer-presence.js";

export interface ActiveDevelopersProps {
  developers: readonly ActiveDeveloperPresence[];
  status?: DeveloperPresenceSnapshot["status"];
}

function activityLabel(activity: ActiveDeveloperPresence["activity"]) {
  return activity.replace(/_/g, " ");
}

export function ActiveDevelopers({
  developers,
  status = "joined",
}: ActiveDevelopersProps) {
  if (status === "paused") {
    return (
      <Card aria-label="Active developers">
        <CardHeader>
          <CardTitle>Active developers</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="muted">Presence is paused in your privacy settings.</p>
        </CardContent>
      </Card>
    );
  }

  if (status === "joining") {
    return (
      <Card aria-label="Active developers">
        <CardHeader>
          <CardTitle>Active developers</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="muted" role="status">
            Connecting to project presence…
          </p>
        </CardContent>
      </Card>
    );
  }

  if (status === "offline") {
    return (
      <Card aria-label="Active developers">
        <CardHeader>
          <CardTitle>Active developers</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="muted" role="status">
            Presence is offline. Task synchronization can continue when you
            reconnect.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (status === "unauthorized") {
    return (
      <Card aria-label="Active developers">
        <CardHeader>
          <CardTitle>Active developers</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="auth-error" role="alert">
            You do not have access to this project&apos;s presence channel.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (status === "error") {
    return (
      <Card aria-label="Active developers">
        <CardHeader>
          <CardTitle>Active developers</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="auth-error" role="alert">
            Project presence could not connect. Task synchronization is still
            available.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card aria-label="Active developers">
      <CardHeader>
        <div className="presence-card-heading">
          <CardTitle>Active developers</CardTitle>
          <Badge tone="success">{developers.length} active</Badge>
        </div>
        <p className="muted">
          Ephemeral project presence. No source content is shared.
        </p>
      </CardHeader>
      <CardContent>
        {developers.length ? (
          <ul
            aria-label="Active developer list"
            className="presence-developer-list"
          >
            {developers.map((developer) => (
              <li className="presence-developer" key={developer.userId}>
                <span aria-hidden="true" className="status-dot" />
                <div className="presence-developer-copy">
                  <strong>
                    {developer.displayName ?? "ReleaseArc member"}
                  </strong>
                  <span>
                    {activityLabel(developer.activity)}
                    {developer.taskId ? ` · task ${developer.taskId}` : ""}
                  </span>
                  {developer.branch ? (
                    <small>Branch: {developer.branch}</small>
                  ) : null}
                  {developer.file?.fileName ? (
                    <small>File: {developer.file.fileName}</small>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No developers are active in this project.</p>
        )}
      </CardContent>
    </Card>
  );
}

export function DeveloperPresencePanel({
  presence,
}: {
  presence: DeveloperPresenceController;
}) {
  const subscribe = useCallback(
    (listener: () => void) => presence.subscribe(listener),
    [presence],
  );
  const getSnapshot = useCallback(() => presence.getSnapshot(), [presence]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return (
    <ActiveDevelopers
      developers={snapshot.developers}
      status={snapshot.status}
    />
  );
}
