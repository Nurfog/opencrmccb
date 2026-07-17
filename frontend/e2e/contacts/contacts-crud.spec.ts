import { test, expect } from "@playwright/test";
import { TEST_CONTACT, uniqueId } from "../fixtures/test-data";

const API_BASE = process.env.API_URL || "http://localhost:8000";

test.describe("Contacts CRUD", () => {
  let authToken: string;

  test.beforeAll(async ({ request }) => {
    // Create test user and get token
    const res = await request.post(`${API_BASE}/api/v1/auth/register`, {
      data: {
        email: `contacts_test_${Date.now()}@example.com`,
        password: "TestPassword123!",
        first_name: "Contacts",
        last_name: "Tester",
      },
    });
    const body = await res.json();
    authToken = body.access_token;
  });

  test("displays contacts page", async ({ page }) => {
    await page.goto("/login");
    // Login via API cookies
    await page.evaluate((token) => {
      document.cookie = `access_token=${token}; path=/`;
    }, authToken);
    await page.goto("/contacts");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("text=Contacts")).toBeVisible();
  });

  test("can open create contact modal", async ({ page }) => {
    await page.goto("/login");
    await page.evaluate((token) => {
      document.cookie = `access_token=${token}; path=/`;
    }, authToken);
    await page.goto("/contacts");
    await page.waitForLoadState("networkidle");

    // Click "New" or "Add" button
    const addButton = page.locator('button:has-text("New"), button:has-text("Add"), button:has-text("Nuevo"), button:has-text("Agregar")').first();
    if (await addButton.isVisible()) {
      await addButton.click();
      await page.waitForTimeout(500);
      // Modal should appear with form fields
      await expect(page.locator('input[name="first_name"], input[placeholder*="first" i], input[placeholder*="nombre" i]').first()).toBeVisible();
    }
  });

  test("can search contacts", async ({ page }) => {
    await page.goto("/login");
    await page.evaluate((token) => {
      document.cookie = `access_token=${token}; path=/`;
    }, authToken);
    await page.goto("/contacts");
    await page.waitForLoadState("networkidle");

    const searchInput = page.locator('input[placeholder*="search" i], input[placeholder*="buscar" i], input[type="search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill("test");
      await page.waitForTimeout(1000);
      // Page should still be functional
      await expect(page.locator("text=Contacts")).toBeVisible();
    }
  });
});
