import { test, expect } from "@playwright/test";

test.describe("Terminal smoke", () => {
  test.afterAll(async () => {
    // Attempt to clean up any wt_* tmux sessions created during tests.
    // This is best-effort; failures are ignored so the test suite is not
    // broken by cleanup issues.
    //
    // spawnSync with an argument array is used throughout (no shell interpolation)
    // so tmux session names cannot inject shell metacharacters.
    const { spawnSync } = await import("child_process");
    try {
      const result = spawnSync("tmux", ["list-sessions", "-F", "#{session_name}"], {
        encoding: "utf8",
      });
      if (result.status === 0 && result.stdout) {
        for (const session of result.stdout.split("\n").filter((s) => s.startsWith("wt_"))) {
          // Pass session name as a discrete argument — never interpolated into a shell string.
          spawnSync("tmux", ["kill-session", "-t", session]);
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  test("clicking sample-project mounts an xterm terminal", async ({ page }) => {
    await page.goto("/");

    // On narrower viewports open the drawer first
    const viewport = page.viewportSize();
    if (viewport && viewport.width < 1440) {
      await page.getByRole("button", { name: "Open navigation menu" }).click();
    }

    // Click the project — this triggers terminal creation
    await page.getByText("sample-project").click();

    // The xterm element should appear
    await expect(page.locator(".xterm")).toBeVisible({ timeout: 30_000 });
  });

  test("WebSocket connects — Disconnected banner is absent after brief wait", async ({ page }) => {
    await page.goto("/");

    const viewport = page.viewportSize();
    if (viewport && viewport.width < 1440) {
      await page.getByRole("button", { name: "Open navigation menu" }).click();
    }

    await page.getByText("sample-project").click();

    // Give the WS time to establish (xterm canvas must appear first)
    await expect(page.locator(".xterm")).toBeVisible({ timeout: 30_000 });

    // The "Disconnected — retrying" banner must NOT be visible once connected
    await expect(page.getByText("Disconnected — retrying")).not.toBeVisible({ timeout: 15_000 });
  });
});
