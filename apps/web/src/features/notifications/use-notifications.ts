import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  notificationRepository,
  type NotificationRecord,
  type NotificationRepository,
  type NotificationScope,
} from "./notification-repository.js";
import {
  createNotificationDelivery,
  notificationRealtimeSubscription,
  type NotificationRealtimeSubscription,
} from "./notification-realtime.js";

function messageFor(cause: unknown) {
  return cause instanceof Error
    ? cause.message
    : "Could not load notifications.";
}

function mergeNotifications(
  current: NotificationRecord[],
  next: NotificationRecord,
) {
  const merged = new Map(
    current.map((notification) => [notification.id, notification]),
  );
  merged.set(next.id, next);
  return [...merged.values()].sort((left, right) => {
    const timeOrder = Date.parse(right.createdAt) - Date.parse(left.createdAt);
    return timeOrder || right.id.localeCompare(left.id);
  });
}

export function useNotifications(
  scope: NotificationScope | null,
  repository: NotificationRepository = notificationRepository,
  realtimeSubscription: NotificationRealtimeSubscription | null = notificationRealtimeSubscription,
) {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const scopeVersion = useRef(0);
  const mounted = useRef(false);
  const activeScope = useMemo(
    () => scope,
    [scope?.organizationId, scope?.projectId, scope?.userId],
  );

  const reload = useCallback(async () => {
    const request = ++generation.current;
    if (!activeScope) {
      setNotifications([]);
      setError(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const next = await repository.list(activeScope);
      if (mounted.current && generation.current === request)
        setNotifications(next);
    } catch (cause) {
      if (mounted.current && generation.current === request) {
        setNotifications([]);
        setError(messageFor(cause));
      }
    } finally {
      if (mounted.current && generation.current === request)
        setIsLoading(false);
    }
  }, [activeScope, repository]);

  useEffect(() => {
    mounted.current = true;
    void reload();
    if (!activeScope) {
      return () => {
        mounted.current = false;
        scopeVersion.current += 1;
        generation.current += 1;
      };
    }
    const currentScopeVersion = ++scopeVersion.current;
    const delivery = createNotificationDelivery(
      realtimeSubscription,
      async () => {
        if (mounted.current && scopeVersion.current === currentScopeVersion)
          await reload();
      },
    );
    const unsubscribe = delivery.subscribe(activeScope, {
      onChange: ({ eventType, notification }) => {
        if (!mounted.current || scopeVersion.current !== currentScopeVersion)
          return;
        if (eventType === "DELETE") {
          setNotifications((current) =>
            current.filter(({ id }) => id !== notification.id),
          );
          return;
        }
        setNotifications((current) =>
          mergeNotifications(current, notification),
        );
      },
    });
    return () => {
      mounted.current = false;
      scopeVersion.current += 1;
      generation.current += 1;
      unsubscribe();
    };
  }, [activeScope, realtimeSubscription, reload, repository]);

  const markRead = useCallback(
    async (notificationId: string, read = true) => {
      if (!activeScope) return;
      setIsMutating(true);
      setError(null);
      try {
        const saved = await repository.markRead(
          activeScope,
          notificationId,
          read,
        );
        if (mounted.current) {
          setNotifications((current) =>
            current.map((notification) =>
              notification.id === saved.id ? saved : notification,
            ),
          );
        }
        return saved;
      } catch (cause) {
        const message = messageFor(cause);
        if (mounted.current) setError(message);
        throw cause;
      } finally {
        if (mounted.current) setIsMutating(false);
      }
    },
    [activeScope, repository],
  );

  const markAllRead = useCallback(async () => {
    if (!activeScope) return 0;
    setIsMutating(true);
    setError(null);
    try {
      const count = await repository.markAllRead(activeScope);
      if (mounted.current) {
        setNotifications((current) =>
          current.map((notification) => ({
            ...notification,
            readAt: notification.readAt ?? new Date().toISOString(),
          })),
        );
      }
      return count;
    } catch (cause) {
      const message = messageFor(cause);
      if (mounted.current) setError(message);
      throw cause;
    } finally {
      if (mounted.current) setIsMutating(false);
    }
  }, [activeScope, repository]);

  return {
    error,
    isLoading,
    isMutating,
    markAllRead,
    markRead,
    notifications,
    reload,
    unreadCount: notifications.filter(({ readAt }) => !readAt).length,
  };
}
