import { describe, it, expect } from "vitest";
import { sortContainers } from "./dockerSort";
import type { DockerContainer } from "./api";

const c = (over: Partial<DockerContainer>): DockerContainer => ({
  ID: "id",
  Names: "n",
  Image: "img",
  State: "running",
  Status: "Up",
  Ports: "",
  CreatedAt: "",
  ...over,
});

describe("sortContainers", () => {
  const list = [
    c({ Names: "redis", State: "exited" }),
    c({ Names: "web", State: "running" }),
    c({ Names: "db", State: "paused" }),
  ];

  it("sorts running containers first when sorting by State asc", () => {
    expect(sortContainers(list, "State", "asc").map((x) => x.Names)).toEqual([
      "web", // running
      "db", // paused
      "redis", // exited
    ]);
  });

  it("reverses with desc", () => {
    expect(sortContainers(list, "State", "desc").map((x) => x.Names)).toEqual([
      "redis",
      "db",
      "web",
    ]);
  });

  it("sorts by name alphabetically (case-insensitive)", () => {
    expect(sortContainers(list, "Names", "asc").map((x) => x.Names)).toEqual(["db", "redis", "web"]);
  });

  it("ranks unknown states last", () => {
    const withUnknown = [c({ Names: "weird", State: "zombie" }), c({ Names: "ok", State: "running" })];
    expect(sortContainers(withUnknown, "State", "asc").map((x) => x.Names)).toEqual(["ok", "weird"]);
  });

  it("does not mutate the input array", () => {
    const before = list.map((x) => x.Names);
    sortContainers(list, "State", "asc");
    expect(list.map((x) => x.Names)).toEqual(before);
  });
});
