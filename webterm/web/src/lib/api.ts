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
};

export type FsEntry = { name: string; dir: boolean; size: number; mtime: number };
