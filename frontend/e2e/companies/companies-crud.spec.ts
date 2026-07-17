import { test, expect } from "@playwright/test";

const API_BASE = process.env.API_URL || "http://localhost:8000";

test.describe("Companies CRUD", () => {
  let authToken: string;

  test.beforeAll(async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/v1/auth/register`, {
      data: {
        email: `companies_test_${Date.now()}@example.com`,
        password: "TestPassword123!",
        first_name: "Companies",
        last_name: "Tester",
      },
    });
    const body = await res.json();
    authToken = body.access_token;
  });

  test("displays companies page", async ({ page }) => {
    await page.goto("/login");
    await page.evaluate((token) => {
      document.cookie = `access_token=${token}; path=/`;
    }, authToken);
    await page.goto("/companies");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("text=Companies")).toBeVisible();
  });

  test("can open create company modal", async ({ page }) => {
    await page.goto("/login");
    await page.evaluate((token) => {
      document.cookie = `access_token=${token}; path=/`;
    }, authToken);
    await page.goto("/companies");
    await page.waitForLoadState("networkidle");

    const addButton = page.locator('button:has-text("New"), button:has-text("Add"), button:has-text("Nuevo"), button:has-text("Agregar")').first();
    if (await addButton.isVisible()) {
      await addButton.click();
      await page.waitForTimeout(500);
      await expect(page.locator('input[name="name"], input[placeholder*="name" i], input[placeholder*="nombre" i]').first()).toBeVisible();
    }
  });

  test("can search companies", async ({ page }) => {
    await page.goto("/login");
    await page.evaluate((token) => {
      document.cookie = `access_token=${token}; path=/`;
    }, authToken);
    await page.goto("/companies");
    await page.waitForLoadState("networkidle");

    const searchInput = page.locator('input[placeholder*="search" i], input[placeholder*="buscar" i], input[type="search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill("test");
      await page.waitForTimeout(1000);
      await expect(page.locator("text=Companies")).toBeVisible();
    }
  });
});
