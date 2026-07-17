import { test, expect } from "@playwright/test";
import { uniqueId } from "../fixtures/test-data";

test.describe("Register", () => {
  test("shows registration form", async ({ page }) => {
    await page.goto("/register");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("shows error with mismatched passwords", async ({ page }) => {
    await page.goto("/register");
    await page.fill('input[name="first_name"], input[placeholder*="nombre" i], input:first-of-type', "Test");
    await page.fill('input[name="last_name"], input:nth-of-type(2)', "User");
    await page.fill('input[type="email"]', `reg_${uniqueId("test")}@example.com`);
    const passwordInputs = page.locator('input[type="password"]');
    await passwordInputs.nth(0).fill("Password123!");
    await passwordInputs.nth(1).fill("DifferentPassword!");
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1000);
    // Should show validation error or stay on register
    await expect(page).toHaveURL(/register/);
  });

  test("navigates to login page", async ({ page }) => {
    await page.goto("/register");
    await page.click('a[href="/login"]');
    await expect(page).toHaveURL(/login/);
  });
});
