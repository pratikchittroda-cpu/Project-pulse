import { createContext, useContext, type ReactNode } from "react";

export interface ProjectSummary {
  id: string;
  key: string;
  name: string;
}

interface ProjectContextValue {
  project: ProjectSummary;
}

interface ProjectProviderProps {
  children: ReactNode;
  initialProject?: ProjectSummary;
}

export const DEFAULT_PROJECT: ProjectSummary = {
  id: "projectpulse-demo",
  key: "PULSE",
  name: "ProjectPulse",
};

const ProjectContext = createContext<ProjectContextValue | undefined>(
  undefined,
);

export function ProjectProvider({
  children,
  initialProject = DEFAULT_PROJECT,
}: ProjectProviderProps) {
  return (
    <ProjectContext.Provider value={{ project: initialProject }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);

  if (!context) {
    throw new Error("useProject must be used inside a ProjectProvider");
  }

  return context;
}
