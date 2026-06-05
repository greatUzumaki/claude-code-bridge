import type { Layout } from "./grouping";

async function j<T>(r: Response): Promise<T> {
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? r.statusText);
  return r.json();
}

export const api = {
  listProjects: () => fetch("/api/projects/list").then(j<Layout>),
  createProject: (name: string, groupId = "", gitInit = false) =>
    fetch("/api/projects/create", {
      method: "POST",
      body: JSON.stringify({ name, groupId, gitInit }),
    }).then(j),
  moveProject: (projectId: string, groupId: string, order: number) =>
    fetch("/api/projects/move", {
      method: "POST",
      body: JSON.stringify({ projectId, groupId, order }),
    }).then(j),
  createGroup: (name: string) =>
    fetch("/api/groups/create", { method: "POST", body: JSON.stringify({ name }) }).then(j),
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
    fetch("/api/fs/write", { method: "PUT", body: JSON.stringify({ path, content }) }).then(j),
};

export type FsEntry = { name: string; dir: boolean; size: number; mtime: number };
