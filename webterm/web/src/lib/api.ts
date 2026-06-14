import type { Layout } from "./grouping";

async function j<T>(r: Response): Promise<T> {
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? r.statusText);
  return r.json();
}

// Request init for JSON-body mutations — sets Content-Type so the request is
// unambiguous to the server and any future middleware.
const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  listProjects: () => fetch("/api/projects/list").then(j<Layout>),
  createProject: (name: string, groupId = "", gitInit = false) =>
    fetch("/api/projects/create", jsonInit("POST", { name, groupId, gitInit })).then(j),
  moveProject: (projectId: string, groupId: string, order: number) =>
    fetch("/api/projects/move", jsonInit("POST", { projectId, groupId, order })).then(j),
  deleteProject: (projectId: string) =>
    fetch(`/api/projects/delete?projectId=${encodeURIComponent(projectId)}`, {
      method: "DELETE",
    }).then(j),
  createGroup: (name: string) => fetch("/api/groups/create", jsonInit("POST", { name })).then(j),
  renameGroup: (groupId: string, name: string) =>
    fetch("/api/groups/rename", jsonInit("POST", { groupId, name })).then(j),
  deleteGroup: (groupId: string) =>
    fetch(`/api/groups/delete?groupId=${encodeURIComponent(groupId)}`, { method: "DELETE" }).then(
      j,
    ),

  listDir: (path: string) =>
    fetch(`/api/fs/list?path=${encodeURIComponent(path)}`).then(j<{ entries: FsEntry[] }>),
  readFile: (path: string) =>
    fetch(`/api/fs/read?path=${encodeURIComponent(path)}`).then(
      j<{ content?: string; tooLarge?: boolean }>,
    ),
  writeFile: (path: string, content: string) =>
    fetch("/api/fs/write", jsonInit("PUT", { path, content })).then(j),
  createFile: (path: string, content = "") =>
    fetch("/api/fs/create", jsonInit("POST", { path, content })).then(j),
  mkdir: (path: string) => fetch("/api/fs/mkdir", jsonInit("POST", { path })).then(j),

  gitShow: (path: string) =>
    fetch(`/api/fs/gitshow?path=${encodeURIComponent(path)}`).then(
      j<{ isRepo: boolean; exists?: boolean; content?: string; tooLarge?: boolean }>,
    ),

  rawUrl: (path: string): string => `/api/fs/raw?path=${encodeURIComponent(path)}`,
  searchFiles: (path: string, q: string): Promise<{ matches: string[] }> =>
    fetch(`/api/fs/search?path=${encodeURIComponent(path)}&q=${encodeURIComponent(q)}`).then(
      j<{ matches: string[] }>,
    ),

  listTerms: (): Promise<{ sessions: string[] }> =>
    fetch("/api/term/list").then(j<{ sessions: string[] }>),
  killTerm: (session: string) =>
    fetch(`/api/term/kill?session=${encodeURIComponent(session)}`, { method: "POST" }).then(j),

  cloneProject: (url: string, name?: string) =>
    fetch("/api/projects/clone", jsonInit("POST", { url, name })).then(
      j<{ ok: boolean; name: string }>,
    ),

  gitStatus: (): Promise<{
    statuses: Record<string, { isRepo: boolean; branch?: string; dirty?: boolean }>;
  }> =>
    fetch("/api/git/status").then(
      j<{ statuses: Record<string, { isRepo: boolean; branch?: string; dirty?: boolean }> }>,
    ),

  hostStats: (): Promise<{
    cpuPercent: number;
    memUsedMB: number;
    memTotalMB: number;
    memPercent: number;
    load1: number;
  }> =>
    fetch("/api/host/stats").then(
      j<{
        cpuPercent: number;
        memUsedMB: number;
        memTotalMB: number;
        memPercent: number;
        load1: number;
      }>,
    ),

  listContainers: (): Promise<{ available: boolean; error?: string; containers: DockerContainer[] }> =>
    fetch("/api/docker/ps").then(
      j<{ available: boolean; error?: string; containers: DockerContainer[] }>,
    ),

  dockerAction: (id: string, action: "start" | "stop" | "restart") =>
    fetch("/api/docker/action", jsonInit("POST", { id, action })).then(j),

  listProcesses: (): Promise<{ processes: ProcInfo[]; listening: ListenPort[] }> =>
    fetch("/api/sys/processes").then(j<{ processes: ProcInfo[]; listening: ListenPort[] }>),
  killProcess: (pid: number, signal?: "KILL") =>
    fetch(
      `/api/sys/kill?pid=${encodeURIComponent(pid)}${signal ? `&signal=${signal}` : ""}`,
      { method: "POST" },
    ).then(j),
};

export type FsEntry = { name: string; dir: boolean; size: number; mtime: number };

// `docker ps --format '{{json .}}'` emits capitalised field names.
export type DockerContainer = {
  ID: string;
  Names: string;
  Image: string;
  State: string;
  Status: string;
  Ports: string;
  CreatedAt: string;
  RunningFor?: string;
};

export type ProcInfo = {
  pid: number;
  name: string;
  user: string;
  cpu: number;
  memMB: number;
  cmd: string;
  ports?: number[];
};

export type ListenPort = { port: number; pid: number; name: string };
