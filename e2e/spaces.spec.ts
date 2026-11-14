import { test, expect } from "@playwright/test";

test.describe("Spaces", () => {
  test("lists spaces in a table and opens the create dialog", async ({ page }) => {
    await page.goto("/spaces");
    await expect(page.getByRole("heading", { name: /^spaces$/i })).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();

    await page.getByRole("button", { name: /new space/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Name")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });
});
