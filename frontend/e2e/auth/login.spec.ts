import { test, expect } from "@playwright/test";

test.describe("Login", () => {
  test("shows login form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("shows error with invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "nonexistent@example.com");
    await page.fill('input[type="password"]', "WrongPassword123!");
    await page.click('button[type="submit"]');
    await page.waitForLoadState("networkidle");
    // Should show an error message or stay on login page
    await expect(page).toHaveURL(/login/);
  });

  test("navigates to register page", async ({ page }) => {
    await page.goto("/login");
    await page.click('a[href="/register"]');
    await expect(page).toHaveURL(/register/);
  });

  test("navigates to forgot password page", async ({ page }) => {
    await page.goto("/login");
    await page.click('a[href="/forgot-password"]');
    await expect(page).toHaveURL(/forgot-password/);
  });
});
