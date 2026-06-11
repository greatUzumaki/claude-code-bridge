import { describe, it, expect } from "vitest";
import { filterProcesses, sortProcesses } from "./procFilter";
import type { ProcInfo } from "./api";

const p = (over: Partial<ProcInfo>): ProcInfo => ({
  pid: 1,
  name: "x",
  user: "u",
  cpu: 0,
  memMB: 0,
  cmd: "",
  ...over,
});

describe("filterProcesses", () => {
  it("filters by name (case-insensitive), pid, port, and command", () => {
    const procs = [
      p({ pid: 10, name: "nginx", cmd: "nginx -g", ports: [80] }),
      p({ pid: 20, name: "redis", cmd: "redis-server" }),
    ];
    expect(filterProcesses(procs, "NGINX").map((x) => x.pid)).toEqual([10]);
    expect(filterProcesses(procs, "80").map((x) => x.pid)).toEqual([10]);
    expect(filterProcesses(procs, "redis-server").map((x) => x.pid)).toEqual([20]);
    expect(filterProcesses(procs, "20").map((x) => x.pid)).toEqual([20]);
  });

  it("returns everything when the query is blank/whitespace", () => {
    const procs = [p({ pid: 1 }), p({ pid: 2 })];
    expect(filterProcesses(procs, "   ")).toHaveLength(2);
  });
});

describe("sortProcesses", () => {
  const procs = [
    p({ pid: 3, name: "Bravo", cpu: 5, memMB: 100 }),
    p({ pid: 1, name: "alpha", cpu: 90, memMB: 10 }),
    p({ pid: 2, name: "charlie", cpu: 5, memMB: 50 }),
  ];

  it("sorts by cpu descending (load); ties break by pid ascending", () => {
    // pid1 has the highest cpu; pid2 and pid3 tie at cpu 5 → pid2 (lower pid) first.
    expect(sortProcesses(procs, "cpu", "desc").map((x) => x.pid)).toEqual([1, 2, 3]);
  });

  it("sorts by memory ascending", () => {
    expect(sortProcesses(procs, "memMB", "asc").map((x) => x.pid)).toEqual([1, 2, 3]);
  });

  it("sorts by name case-insensitively", () => {
    expect(sortProcesses(procs, "name", "asc").map((x) => x.name)).toEqual([
      "alpha",
      "Bravo",
      "charlie",
    ]);
  });

  it("sorts by lowest listening port; processes without ports trail (asc)", () => {
    const withPorts = [
      p({ pid: 1, ports: [8080] }),
      p({ pid: 2 }), // no ports → trails
      p({ pid: 3, ports: [80, 443] }), // min 80
    ];
    expect(sortProcesses(withPorts, "ports", "asc").map((x) => x.pid)).toEqual([3, 1, 2]);
  });

  it("sorts by command string", () => {
    const cmds = [p({ pid: 1, cmd: "zsh" }), p({ pid: 2, cmd: "ava" }), p({ pid: 3, cmd: "node" })];
    expect(sortProcesses(cmds, "cmd", "asc").map((x) => x.pid)).toEqual([2, 3, 1]);
  });

  it("does not mutate the input array", () => {
    const before = procs.map((x) => x.pid);
    sortProcesses(procs, "cpu", "desc");
    expect(procs.map((x) => x.pid)).toEqual(before);
  });
});
