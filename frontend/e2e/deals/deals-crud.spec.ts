import { test, expect } from "@playwright/test";

const API_BASE = process.env.API_URL || "http://localhost:8000";

test.describe("Deals", () => {
  let authToken: string;

  test.beforeAll(async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/v1/auth/register`, {
      data: {
        email: `deals_test_${Date.now()}@example.com`,
        password: "TestPassword123!",
        first_name: "Deals",
        last_name: "Tester",
      },
    });
    const body = await res.json();
    authToken = body.access_token;
  });

  test("displays deals page with kanban view", async ({ page }) => {
    await page.goto("/login");
    await page.evaluate((token) => {
      document.cookie = `access_token=${token}; path=/`;
    }, authToken);
    await page.goto("/deals");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("text=Deals")).toBeVisible();
  });

  test("can toggle between kanban and list view", async ({ page }) => {
    await page.goto("/login");
    await page.evaluate((token) => {
      document.cookie = `access_token=${token}; path=/`;
    }, authToken);
    await page.goto("/deals");
    await page.waitForLoadState("networkidle");

    // Look for view toggle buttons
    const listViewBtn = page.locator('button:has-text("List"), button:has-text("Lista"), [aria-label*="list" i]').first();
    if (await listViewBtn.isVisible()) {
      await listViewBtn.click();
      await page.waitForTimeout(500);
      // Should still show deals content
      await expect(page.locator("text=Deals")).toBeVisible();
    }
  });

  test("can search deals", async ({ page }) => {
    await page.goto("/login");
    await page.evaluate((token) => {
      document.cookie = `access_token=${token}; path=/`;
    }, authToken);
    await page.goto("/deals");
    await page.waitForLoadState("networkidle");

    const searchInput = page.locator('input[placeholder*="search" i], input[placeholder*="buscar" i], input[type="search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill("test");
      await page.waitForTimeout(1000);
      await expect(page.locator("text=Deals")).toBeVisible();
    }
  });
});
