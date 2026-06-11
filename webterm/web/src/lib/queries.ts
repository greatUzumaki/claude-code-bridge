import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

// ── Query hooks ───────────────────────────────────────────────────────────────

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: () => api.listProjects(),
    refetchInterval: 5000,
  });
}

export function useGitStatus() {
  return useQuery({
    queryKey: ["git"],
    queryFn: () => api.gitStatus(),
    refetchInterval: 15000,
  });
}

export function useHostStats() {
  return useQuery({
    queryKey: ["host"],
    queryFn: () => api.hostStats(),
    refetchInterval: 4000,
  });
}

export function useDocker() {
  return useQuery({
    queryKey: ["docker"],
    queryFn: () => api.listContainers(),
    refetchInterval: 5000,
  });
}

export function useProcesses() {
  return useQuery({
    queryKey: ["processes"],
    queryFn: () => api.listProcesses(),
    refetchInterval: 5000,
  });
}

export function useDockerAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "start" | "stop" | "restart" }) =>
      api.dockerAction(id, action),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["docker"] }),
  });
}

export function useKillProcess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pid, signal }: { pid: number; signal?: "KILL" }) =>
      api.killProcess(pid, signal),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["processes"] }),
  });
}

export function useTerms(enabled: boolean) {
  return useQuery({
    queryKey: ["terms"],
    queryFn: () => api.listTerms(),
    enabled,
  });
}

export function useDir(path: string) {
  return useQuery({
    queryKey: ["dir", path],
    queryFn: () => api.listDir(path),
  });
}

export function useSearch(root: string, q: string) {
  return useQuery({
    queryKey: ["search", root, q],
    queryFn: () => api.searchFiles(root, q),
    enabled: q.trim() !== "",
  });
}

export function useFile(path: string, enabled: boolean) {
  return useQuery({
    queryKey: ["file", path],
    queryFn: () => api.readFile(path),
    enabled,
    // File content in an editor should never auto-refetch; a background refetch
    // would clobber unsaved edits.
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });
}

// ── Mutation hooks ────────────────────────────────────────────────────────────

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      name,
      groupId,
      gitInit,
    }: {
      name: string;
      groupId?: string;
      gitInit?: boolean;
    }) => api.createProject(name, groupId, gitInit),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useCloneProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ url, name }: { url: string; name?: string }) => api.cloneProject(url, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.createGroup(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => api.deleteProject(projectId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useMoveProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      groupId,
      order,
    }: {
      projectId: string;
      groupId: string;
      order: number;
    }) => api.moveProject(projectId, groupId, order),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useRenameGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, name }: { groupId: string; name: string }) =>
      api.renameGroup(groupId, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useDeleteGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => api.deleteGroup(groupId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useKillTerm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (session: string) => api.killTerm(session),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["terms"] });
      void qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useWriteFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ path, content }: { path: string; content: string }) =>
      api.writeFile(path, content),
    onSuccess: (_data, { path }) => qc.invalidateQueries({ queryKey: ["file", path] }),
  });
}
