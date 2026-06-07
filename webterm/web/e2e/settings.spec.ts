import { test, expect } from "@playwright/test";

test.describe("Settings modal", () => {
  test("open Settings via ⋯ menu and switch to Light theme", async ({ page }) => {
    await page.goto("/");

    // On narrower viewports open the sidebar drawer so we can reach the ⋯ button
    const viewport = page.viewportSize();
    if (viewport && viewport.width < 1440) {
      await page.getByRole("button", { name: "Open navigation menu" }).click();
    }

    // Open the ⋯ (More actions) menu in the sidebar header
    await page.getByRole("button", { name: "More actions" }).click();

    // Click the Settings menu item
    await page.getByRole("menuitem", { name: "Settings" }).click();

    // The Settings dialog should now be visible
    await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible({ timeout: 5_000 });

    // Switch to Light theme
    await page.getByRole("button", { name: "Light" }).click();

    // Assert that the --color-bg CSS custom property changed to the light value
    const colorBg = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--color-bg").trim(),
    );

    expect(colorBg).toBe("#f6f7f9");
  });
});
