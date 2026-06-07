import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import React from "react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useProjects, useCreateProject } from "./queries";
import type { Layout } from "./grouping";

// Mock the entire api module so no real fetch calls are made.
vi.mock("./api", () => ({
  api: {
    listProjects: vi.fn(),
    createProject: vi.fn(),
    moveProject: vi.fn(),
    createGroup: vi.fn(),
    renameGroup: vi.fn(),
    deleteGroup: vi.fn(),
    listDir: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    rawUrl: vi.fn(),
    searchFiles: vi.fn(),
    listTerms: vi.fn(),
    killTerm: vi.fn(),
    cloneProject: vi.fn(),
    gitStatus: vi.fn(),
    hostStats: vi.fn(),
  },
}));

// Import the mocked api so we can configure return values per test.
const { api } = await import("./api");

const MOCK_LAYOUT: Layout = {
  groups: [{ id: "g1", name: "Work", order: 0, collapsed: false }],
  projects: [{ id: "p1", name: "api", path: "/projects/api", groupId: "g1", order: 0 }],
};

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children);
  };
}

function freshClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useProjects", () => {
  it("resolves to the mocked layout on success", async () => {
    vi.mocked(api.listProjects).mockResolvedValue(MOCK_LAYOUT);

    const qc = freshClient();
    const { result } = renderHook(() => useProjects(), { wrapper: makeWrapper(qc) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(MOCK_LAYOUT);
    expect(api.listProjects).toHaveBeenCalledTimes(1);
  });

  it("exposes an error state when the query fails", async () => {
    vi.mocked(api.listProjects).mockRejectedValue(new Error("network failure"));

    const qc = freshClient();
    const { result } = renderHook(() => useProjects(), { wrapper: makeWrapper(qc) });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe("network failure");
  });
});

describe("useCreateProject", () => {
  it("calls api.createProject with the supplied arguments", async () => {
    vi.mocked(api.createProject).mockResolvedValue({ ok: true });
    vi.mocked(api.listProjects).mockResolvedValue(MOCK_LAYOUT);

    const qc = freshClient();
    const { result } = renderHook(() => useCreateProject(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      await result.current.mutateAsync({ name: "new-proj", groupId: "g1", gitInit: true });
    });

    expect(api.createProject).toHaveBeenCalledWith("new-proj", "g1", true);
  });

  it("invalidates the projects query on success (triggering a refetch)", async () => {
    vi.mocked(api.createProject).mockResolvedValue({ ok: true });
    // listProjects will be called once on mount (via invalidation) and again after mutation.
    vi.mocked(api.listProjects).mockResolvedValue(MOCK_LAYOUT);

    const qc = freshClient();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    const { result } = renderHook(() => useCreateProject(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      await result.current.mutateAsync({ name: "proj-x" });
    });

    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ["projects"] }));
  });
});
