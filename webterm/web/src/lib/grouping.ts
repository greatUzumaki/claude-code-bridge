export type Group = { id: string; name: string; order: number; collapsed: boolean };
export type Project = { id: string; name: string; path: string; groupId: string; order: number };
export type Layout = { groups: Group[]; projects: Project[] };

export type Tree = {
  ungrouped: Project[];
  groups: (Group & { projects: Project[] })[];
};

export function buildTree(layout: Layout): Tree {
  const byOrder = (a: { order: number }, b: { order: number }) => a.order - b.order;
  const ungrouped = layout.projects.filter((p) => !p.groupId).sort(byOrder);
  const groups = [...layout.groups].sort(byOrder).map((g) => ({
    ...g,
    projects: layout.projects.filter((p) => p.groupId === g.id).sort(byOrder),
  }));
  return { ungrouped, groups };
}
