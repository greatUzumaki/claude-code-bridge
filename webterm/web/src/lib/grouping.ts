export type Group = { id: string; name: string; order: number; collapsed: boolean };
export type Project = {
  id: string;
  name: string;
  path: string;
  groupId: string;
  order: number;
  active?: boolean;
};
export type Layout = { groups: Group[]; projects: Project[] };

export type Tree = {
  ungrouped: Project[];
  groups: (Group & { projects: Project[] })[];
};

export function buildTree(layout: Layout): Tree {
  // The API serializes empty slices as JSON null (Go nil slice), so coalesce.
  const allGroups = layout.groups ?? [];
  const allProjects = layout.projects ?? [];
  const byOrder = (a: { order: number }, b: { order: number }) => a.order - b.order;
  const ungrouped = allProjects.filter((p) => !p.groupId).sort(byOrder);
  const groups = [...allGroups].sort(byOrder).map((g) => ({
    ...g,
    projects: allProjects.filter((p) => p.groupId === g.id).sort(byOrder),
  }));
  return { ungrouped, groups };
}
