import { test, expect } from "@playwright/test";

test.describe("File tree smoke", () => {
  test("View-files button shows README.md in the file tree", async ({ page }) => {
    await page.goto("/");

    // Step 1: open the nav drawer (needed below 1440px wide:static breakpoint)
    const openNav = async () => {
      const hamburger = page.getByRole("button", { name: "Open navigation menu" });
      if (await hamburger.isVisible()) await hamburger.click();
    };

    await openNav();

    // Step 2: select the project — this wires up the header "View project files" button
    // and closes the nav drawer on narrow viewports.
    await page.getByText("sample-project").click();

    // Step 3: the header now has a "View project files" button next to the project title.
    // Click it to open the file tree inside the sidebar drawer.
    const headerFilesBtn = page.getByRole("button", { name: "View project files" }).last();
    await expect(headerFilesBtn).toBeVisible({ timeout: 5_000 });
    await headerFilesBtn.click();

    // On narrow viewports "View project files" in the header calls handleViewFiles which
    // sets navOpen(true), so the sidebar reopens showing the FileTree component.
    // On wide viewports (≥1440px) the sidebar is always visible.

    // The file tree should render and list README.md
    await expect(page.getByText("README.md")).toBeVisible({ timeout: 10_000 });
  });
});
