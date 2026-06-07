import { test, expect } from "@playwright/test";

test.describe("App smoke", () => {
  test("page loads and shows WebTerm title when no project is selected", async ({ page }) => {
    await page.goto("/");

    // The header shows "WebTerm" when no project is active
    await expect(page.getByText("WebTerm")).toBeVisible({ timeout: 10_000 });
  });

  test("sidebar lists sample-project", async ({ page }) => {
    await page.goto("/");

    // On desktop (≥1440px) the sidebar is always visible.
    // On narrower viewports it's behind a drawer — open it first.
    const viewport = page.viewportSize();
    if (viewport && viewport.width < 1440) {
      await page.getByRole("button", { name: "Open navigation menu" }).click();
    }

    await expect(page.getByText("sample-project")).toBeVisible({ timeout: 10_000 });
  });

  test("default state shows 'select a project' placeholder", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("select a project")).toBeVisible({ timeout: 10_000 });
  });
});
