import {
  createBrowserRouter,
  createMemoryRouter,
  Navigate,
  Outlet,
  type RouteObject,
} from "react-router-dom";

import { type AuthStatus } from "./auth-context.js";
import { AppLayout, AuthLayout, PublicLayout } from "./layouts.js";
import { AppProviders } from "./providers.js";
import { ProtectedRoute } from "./protected-route.js";
import { type ProjectSummary } from "./project-context.js";
import { RouteErrorPage } from "./route-error-page.js";
import { ActivityPage } from "../pages/activity-page.js";
import { AuthCallbackPage } from "../pages/auth-callback-page.js";
import { BoardPage } from "../pages/board-page.js";
import { BacklogPage } from "../pages/backlog-page.js";
import { DashboardPage } from "../pages/dashboard-page.js";
import { LandingPage } from "../pages/landing-page.js";
import { LoginPage } from "../pages/login-page.js";
import { NotFoundPage } from "../pages/not-found-page.js";
import { NotificationsPage } from "../pages/notifications-page.js";
import { OrganizationPage } from "../pages/organization-page.js";
import { ProjectsPage } from "../pages/projects-page.js";
import { RoadmapPage } from "../pages/roadmap-page.js";
import { TasksPage } from "../pages/tasks-page.js";
import { TaskDetailPage } from "../pages/task-detail-page.js";

interface RouterOptions {
  initialAuthStatus?: AuthStatus;
  initialProject?: ProjectSummary;
}

export function createAppRoutes({
  initialAuthStatus,
  initialProject,
}: RouterOptions = {}): RouteObject[] {
  return [
    {
      element: (
        <AppProviders
          initialAuthStatus={initialAuthStatus}
          initialProject={initialProject}
        >
          <Outlet />
        </AppProviders>
      ),
      errorElement: <RouteErrorPage />,
      children: [
        {
          element: <PublicLayout />,
          children: [{ index: true, element: <LandingPage /> }],
        },
        {
          path: "auth",
          element: <AuthLayout />,
          children: [
            { index: true, element: <Navigate replace to="login" /> },
            { path: "callback", element: <AuthCallbackPage /> },
            { path: "login", element: <LoginPage /> },
          ],
        },
        {
          element: <ProtectedRoute />,
          children: [
            {
              element: <AppLayout />,
              children: [
                {
                  path: "app",
                  children: [
                    { index: true, element: <DashboardPage /> },
                    { path: "activity", element: <ActivityPage /> },
                    { path: "notifications", element: <NotificationsPage /> },
                    { path: "board", element: <BoardPage /> },
                    { path: "backlog", element: <BacklogPage /> },
                    { path: "roadmap", element: <RoadmapPage /> },
                    { path: "organization", element: <OrganizationPage /> },
                    { path: "projects", element: <ProjectsPage /> },
                    { path: "tasks", element: <TasksPage /> },
                    {
                      path: "organizations/:organizationId/projects/:projectId/tasks/:taskId",
                      element: <TaskDetailPage />,
                    },
                  ],
                },
              ],
            },
          ],
        },
        { path: "*", element: <NotFoundPage /> },
      ],
    },
  ];
}

export function createAppRouter() {
  return createBrowserRouter(createAppRoutes());
}

export function createTestRouter(
  initialEntries: string[],
  options: RouterOptions = {},
) {
  return createMemoryRouter(
    createAppRoutes({
      ...options,
      initialAuthStatus: options.initialAuthStatus ?? "authenticated",
    }),
    { initialEntries },
  );
}
