import { describe, it, expect } from "vitest";
import { sortContainers, formatPorts } from "./dockerSort";
import type { DockerContainer } from "./api";

describe("formatPorts", () => {
  it("keeps only host→container mappings, drops IP and proto", () => {
    expect(formatPorts("127.0.0.1:6379->6379/tcp")).toBe("6379→6379");
  });
  it("drops exposed-but-unpublished ports (no ->)", () => {
    expect(formatPorts("5778-5779/tcp, 9411/tcp, 127.0.0.1:16686->16686/tcp")).toBe("16686→16686");
  });
  it("keeps port ranges and joins multiple mappings", () => {
    expect(formatPorts("0.0.0.0:9000-9001->9000-9001/tcp, 127.0.0.1:5432->5432/tcp")).toBe(
      "9000-9001→9000-9001, 5432→5432",
    );
  });
  it("returns empty string for no ports / exposed-only", () => {
    expect(formatPorts("")).toBe("");
    expect(formatPorts("80/tcp")).toBe("");
  });
});

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
