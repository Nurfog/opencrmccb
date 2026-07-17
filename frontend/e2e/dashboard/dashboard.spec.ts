import { test, expect } from "@playwright/test";

const API_BASE = process.env.API_URL || "http://localhost:8000";

test.describe("Dashboard", () => {
  let authToken: string;

  test.beforeAll(async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/v1/auth/register`, {
      data: {
        email: `dashboard_test_${Date.now()}@example.com`,
        password: "TestPassword123!",
        first_name: "Dashboard",
        last_name: "Tester",
      },
    });
    const body = await res.json();
    authToken = body.access_token;
  });

  test("displays dashboard page", async ({ page }) => {
    await page.goto("/login");
    await page.evaluate((token) => {
      document.cookie = `access_token=${token}; path=/`;
    }, authToken);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("text=Dashboard")).toBeVisible();
  });

  test("shows stats cards", async ({ page }) => {
    await page.goto("/login");
    await page.evaluate((token) => {
      document.cookie = `access_token=${token}; path=/`;
    }, authToken);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Dashboard should have some stat elements
    const statsSection = page.locator('[class*="grid"], [class*="stats"], [class*="cards"]').first();
    await expect(statsSection).toBeVisible();
  });

  test("has navigation sidebar", async ({ page }) => {
    await page.goto("/login");
    await page.evaluate((token) => {
      document.cookie = `access_token=${token}; path=/`;
    }, authToken);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Should have sidebar navigation links
    const sidebar = page.locator('nav, [class*="sidebar"]').first();
    await expect(sidebar).toBeVisible();
  });
});
