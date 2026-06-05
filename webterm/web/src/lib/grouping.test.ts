import { describe, it, expect } from "vitest";
import { buildTree } from "./grouping";

describe("buildTree", () => {
  it("places ungrouped projects at top and groups their members", () => {
    const layout = {
      groups: [{ id: "g1", name: "Work", order: 0, collapsed: false }],
      projects: [
        { id: "p1", name: "api", path: "api", groupId: "g1", order: 0 },
        { id: "p2", name: "loose", path: "loose", groupId: "", order: 0 },
      ],
    };
    const tree = buildTree(layout);
    expect(tree.ungrouped.map((p) => p.id)).toEqual(["p2"]);
    expect(tree.groups[0].name).toBe("Work");
    expect(tree.groups[0].projects.map((p) => p.id)).toEqual(["p1"]);
  });
});
