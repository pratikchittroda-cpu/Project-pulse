import type { ReactNode } from "react";

import { AuthProvider, type AuthStatus } from "./auth-context.js";
import { OrganizationProvider } from "./organization-context.js";
import { ProjectProvider, type ProjectSummary } from "./project-context.js";

interface AppProvidersProps {
  children: ReactNode;
  initialAuthStatus?: AuthStatus;
  initialProject?: ProjectSummary;
}

export function AppProviders({
  children,
  initialAuthStatus,
  initialProject,
}: AppProvidersProps) {
  return (
    <AuthProvider initialStatus={initialAuthStatus}>
      <OrganizationProvider>
        <ProjectProvider initialProject={initialProject}>
          {children}
        </ProjectProvider>
      </OrganizationProvider>
    </AuthProvider>
  );
}
