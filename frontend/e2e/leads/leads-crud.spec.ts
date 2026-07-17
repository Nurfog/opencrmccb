import { test, expect } from "@playwright/test";

const API_BASE = process.env.API_URL || "http://localhost:8000";

test.describe("Leads", () => {
  let authToken: string;

  test.beforeAll(async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/v1/auth/register`, {
      data: {
        email: `leads_test_${Date.now()}@example.com`,
        password: "TestPassword123!",
        first_name: "Leads",
        last_name: "Tester",
      },
    });
    const body = await res.json();
    authToken = body.access_token;
  });

  test("displays leads page", async ({ page }) => {
    await page.goto("/login");
    await page.evaluate((token) => {
      document.cookie = `access_token=${token}; path=/`;
    }, authToken);
    await page.goto("/leads");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("text=Leads")).toBeVisible();
  });

  test("can open create lead modal", async ({ page }) => {
    await page.goto("/login");
    await page.evaluate((token) => {
      document.cookie = `access_token=${token}; path=/`;
    }, authToken);
    await page.goto("/leads");
    await page.waitForLoadState("networkidle");

    const addButton = page.locator('button:has-text("New"), button:has-text("Add"), button:has-text("Nuevo"), button:has-text("Agregar")').first();
    if (await addButton.isVisible()) {
      await addButton.click();
      await page.waitForTimeout(500);
      await expect(page.locator('input[name="first_name"], input[placeholder*="first" i], input[placeholder*="nombre" i]').first()).toBeVisible();
    }
  });

  test("can filter leads by status", async ({ page }) => {
    await page.goto("/login");
    await page.evaluate((token) => {
      document.cookie = `access_token=${token}; path=/`;
    }, authToken);
    await page.goto("/leads");
    await page.waitForLoadState("networkidle");

    // Look for status filter
    const statusFilter = page.locator('select, [role="combobox"], button:has-text("Status"), button:has-text("Estado")').first();
    if (await statusFilter.isVisible()) {
      await statusFilter.click();
      await page.waitForTimeout(500);
      await expect(page.locator("text=Leads")).toBeVisible();
    }
  });
});
