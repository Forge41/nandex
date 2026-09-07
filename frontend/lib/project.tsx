"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api";
import { useSession } from "./session";

type Project = { id: string; name: string; description: string; created_at: string };

type ProjectContextValue = { project: Project | null };

const ProjectContext = createContext<ProjectContextValue>({ project: null });

/** No project-switcher for v1 -- every user has exactly one auto-created "Default"
 * project (see backend's verify_and_login); this just takes the first one. */
export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const { session } = useSession();
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    if (session.status !== "authenticated") return;
    api.get<Project[]>("/projects").then((projects) => setProject(projects[0] ?? null));
  }, [session.status]);

  return <ProjectContext.Provider value={{ project }}>{children}</ProjectContext.Provider>;
}

export function useProject() {
  return useContext(ProjectContext);
}
