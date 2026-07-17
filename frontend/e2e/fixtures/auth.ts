import { test as base, type Page, type BrowserContext } from "@playwright/test";

const API_BASE = process.env.API_URL || "http://localhost:8000";

export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Register a test user via API
    const timestamp = Date.now();
    const email = `test_${timestamp}@example.com`;
    const password = "TestPassword123!";

    const registerRes = await page.request.post(`${API_BASE}/api/v1/auth/register`, {
      data: {
        email,
        password,
        first_name: "Test",
        last_name: "User",
      },
    });

    if (registerRes.ok()) {
      const body = await registerRes.json();
      // Set auth cookies from the response
      const setCookies = registerRes.headers()["set-cookie"];
      if (setCookies) {
        const cookies = setCookies.split(",").map((c: string) => {
          const [nameValue] = c.trim().split(";");
          const [name, value] = nameValue.split("=");
          return {
            name: name.trim(),
            value: value.trim(),
            domain: "localhost",
            path: "/",
          };
        });
        await context.addCookies(cookies);
      }
      // Also set tokens in memory via page context
      if (body.access_token) {
        await page.evaluate(
          ({ token }) => {
            (window as any).__CRM_TOKENS__ = { access: token };
          },
          { token: body.access_token }
        );
      }
    }

    await use(page);
    await context.close();
  },
});

export { expect } from "@playwright/test";
