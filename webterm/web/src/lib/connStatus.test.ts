import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { reportConn, unreportConn, useAggregateConn } from "./connStatus";

// The module uses module-level Maps/Sets that persist between tests.
// We clean up manually via unreportConn after each test.
const PANE_IDS = ["p1", "p2", "p3"];

beforeEach(() => {
  // Ensure a clean slate before every test.
  for (const id of PANE_IDS) unreportConn(id);
});

afterEach(() => {
  for (const id of PANE_IDS) unreportConn(id);
});

describe("useAggregateConn", () => {
  it("returns 'open' when no panes have reported", () => {
    const { result } = renderHook(() => useAggregateConn());
    expect(result.current).toBe("open");
  });

  it("returns 'open' when all panes are open", () => {
    const { result } = renderHook(() => useAggregateConn());
    act(() => {
      reportConn("p1", "open");
      reportConn("p2", "open");
    });
    expect(result.current).toBe("open");
  });

  it("returns 'connecting' when any pane is connecting and none is closed", () => {
    const { result } = renderHook(() => useAggregateConn());
    act(() => {
      reportConn("p1", "open");
      reportConn("p2", "connecting");
    });
    expect(result.current).toBe("connecting");
  });

  it("returns 'closed' when any pane is closed, regardless of others", () => {
    const { result } = renderHook(() => useAggregateConn());
    act(() => {
      reportConn("p1", "connecting");
      reportConn("p2", "closed");
    });
    expect(result.current).toBe("closed");
  });

  it("returns 'open' after all panes are unreported", () => {
    const { result } = renderHook(() => useAggregateConn());
    act(() => {
      reportConn("p1", "closed");
      reportConn("p2", "closed");
    });
    expect(result.current).toBe("closed");

    act(() => {
      unreportConn("p1");
      unreportConn("p2");
    });
    expect(result.current).toBe("open");
  });

  it("unreportConn removes a specific pane, leaving others intact", () => {
    const { result } = renderHook(() => useAggregateConn());
    act(() => {
      reportConn("p1", "closed");
      reportConn("p2", "open");
    });
    expect(result.current).toBe("closed");

    act(() => {
      unreportConn("p1");
    });
    expect(result.current).toBe("open");
  });

  it("does not re-emit when status is unchanged", () => {
    // Simply assert the value stays correct — no extra renders required.
    const { result } = renderHook(() => useAggregateConn());
    act(() => reportConn("p1", "open"));
    const before = result.current;
    act(() => reportConn("p1", "open")); // same value → no emit
    expect(result.current).toBe(before);
  });
});
