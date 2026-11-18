// Signs in as the demo user of the local instance (make demo).
export async function login(page) {
  await page.goto("http://127.0.0.1:5173/login");
  await page.locator('input[type="email"]').fill("demo@equori.local");
  await page.locator('input[type="password"]').fill("equori-demo-account");
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}
