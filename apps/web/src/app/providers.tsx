import type { ReactNode } from "react";

import { AuthProvider, type AuthStatus } from "./auth-context.js";
import {
  DEFAULT_PROJECT,
  ProjectProvider,
  type ProjectSummary,
} from "./project-context.js";

interface AppProvidersProps {
  children: ReactNode;
  initialAuthStatus?: AuthStatus;
  initialProject?: ProjectSummary;
}

export function AppProviders({
  children,
  initialAuthStatus = "authenticated",
  initialProject = DEFAULT_PROJECT,
}: AppProvidersProps) {
  return (
    <AuthProvider initialStatus={initialAuthStatus}>
      <ProjectProvider initialProject={initialProject}>
        {children}
      </ProjectProvider>
    </AuthProvider>
  );
}
