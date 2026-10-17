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
import { DashboardPage } from "../pages/dashboard-page.js";
import { LandingPage } from "../pages/landing-page.js";
import { LoginPage } from "../pages/login-page.js";
import { NotFoundPage } from "../pages/not-found-page.js";
import { OrganizationPage } from "../pages/organization-page.js";
import { ProjectsPage } from "../pages/projects-page.js";

interface RouterOptions {
  initialAuthStatus?: AuthStatus;
  initialProject?: ProjectSummary;
}

export function createAppRoutes({
  initialAuthStatus = "authenticated",
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
                    { path: "organization", element: <OrganizationPage /> },
                    { path: "projects", element: <ProjectsPage /> },
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
