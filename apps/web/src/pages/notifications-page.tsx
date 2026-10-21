import { Link } from "react-router-dom";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageLayout,
} from "@projectpulse/ui";

import { useAuth } from "../app/auth-context.js";
import { useOrganization } from "../app/organization-context.js";
import {
  notificationRepository,
  type NotificationRepository,
  type NotificationScope,
} from "../features/notifications/notification-repository.js";
import {
  notificationRealtimeSubscription,
  type NotificationRealtimeSubscription,
} from "../features/notifications/notification-realtime.js";
import { useNotifications } from "../features/notifications/use-notifications.js";
import type { ReactNode } from "react";

const typeLabels: Record<string, string> = {
  task_assigned: "Assigned",
  task_status_changed: "Status",
  task_comment_mention: "Mention",
  task_review_requested: "Review",
  task_ci_failed: "CI",
  task_event: "Activity",
};

function notificationTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
}

export function NotificationInbox({
  repository = notificationRepository,
  realtimeSubscription = notificationRealtimeSubscription,
  scope,
}: {
  repository?: NotificationRepository;
  realtimeSubscription?: NotificationRealtimeSubscription | null;
  scope: NotificationScope | null;
}) {
  const {
    error,
    isLoading,
    isMutating,
    markAllRead,
    markRead,
    notifications,
    reload,
    unreadCount,
  } = useNotifications(scope, repository, realtimeSubscription);

  return (
    <PageLayout
      actions={
        <div className="project-actions">
          <Button
            disabled={isMutating || unreadCount === 0}
            onClick={() => void markAllRead()}
            size="sm"
            variant="secondary"
          >
            Mark all read
          </Button>
          <Button
            disabled={isLoading}
            onClick={() => void reload()}
            size="sm"
            variant="secondary"
          >
            Refresh
          </Button>
        </div>
      }
      description={
        unreadCount
          ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
          : "You are caught up."
      }
      eyebrow="Workspace signals"
      title="Notifications"
    >
      {error ? (
        <p role="alert" className="auth-error">
          {error}
        </p>
      ) : null}
      <Card aria-label="Notification inbox">
        <CardHeader>
          <CardTitle>Inbox</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p role="status">Loading notifications…</p>
          ) : notifications.length ? (
            <ul className="notification-list">
              {notifications.map((notification) => (
                <li
                  className={`notification-item${notification.readAt ? "" : " notification-item-unread"}`}
                  key={notification.id}
                >
                  <div className="notification-item-copy">
                    <div className="notification-item-heading">
                      <Badge tone={notification.readAt ? "neutral" : "accent"}>
                        {typeLabels[notification.notificationType] ??
                          "Activity"}
                      </Badge>
                      <time dateTime={notification.createdAt}>
                        {notificationTime(notification.createdAt)}
                      </time>
                    </div>
                    <Link
                      className="notification-link"
                      onClick={() => {
                        if (!notification.readAt)
                          void markRead(notification.id);
                      }}
                      to={notification.deepLink}
                    >
                      <strong>{notification.title}</strong>
                      <span>{notification.body}</span>
                    </Link>
                  </div>
                  <Button
                    aria-label={`${notification.readAt ? "Mark unread" : "Mark read"}: ${notification.title}`}
                    disabled={isMutating}
                    onClick={() =>
                      void markRead(notification.id, !notification.readAt)
                    }
                    size="sm"
                    variant="ghost"
                  >
                    {notification.readAt ? "Unread" : "Read"}
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="notification-empty">
              <strong>No notifications yet</strong>
              <p className="muted">
                Mentions, assignments, reviews, CI failures, and important task
                activity will appear here.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </PageLayout>
  );
}

export function NotificationsPage() {
  const { session, status } = useAuth();
  const { selectedOrganizationId } = useOrganization();
  if (status === "loading") return <p role="status">Loading notifications…</p>;
  if (!session) {
    return (
      <PageLayout
        title="Sign in to view notifications"
        description="Notifications are scoped to your authenticated project access."
      >
        <Link to="/auth/login">Sign in</Link>
      </PageLayout>
    );
  }
  return (
    <NotificationInbox
      scope={{
        organizationId: selectedOrganizationId || undefined,
        userId: session.user.id,
      }}
    />
  );
}

export function NotificationHeaderLink({
  children,
  unreadCount,
}: {
  children?: ReactNode;
  unreadCount?: number;
}) {
  return (
    <Link
      aria-label={
        unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"
      }
      className="header-quick-link notification-header-link"
      to="/app/notifications"
    >
      <span aria-hidden="true">♢</span> {children ?? "Notifications"}
      {unreadCount ? (
        <span
          className="notification-count"
          aria-label={`${unreadCount} unread`}
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null}
    </Link>
  );
}
