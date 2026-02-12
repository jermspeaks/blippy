import { test, expect } from "@playwright/test";

test.describe("Feed", () => {
  test("feed page loads and shows heading", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /feed/i })).toBeVisible();
  });

  test("navigation to capture works", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("navigation")
      .getByRole("link", { name: /capture/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/capture/);
    await expect(
      page.getByRole("heading", { name: /quick capture/i })
    ).toBeVisible();
  });

  test("navigation to settings and theme section", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /settings/i }).click();
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.getByRole("heading", { name: /theme/i })).toBeVisible();
  });
});
