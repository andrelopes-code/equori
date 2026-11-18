// Records the video of "Pay a statement" on the demo book (make demo, make run-dev), in both
// schemes, without writing: the recording ends on the confirm button.
// Usage: node video.mjs <setup.mjs with login(page)> <out dir>
import { signIn, loadSetup, withBrowser } from "/home/dreco/.claude/skills/redesign-ui-section/scripts/lib.mjs";
import { mkdirSync, renameSync } from "node:fs";

const [setupPath, out] = process.argv.slice(2);
const base = "http://127.0.0.1:5173";
const size = { width: 1024, height: 640 };
const setup = await loadSetup(setupPath);

// The recording holds no pointer; this dot follows the mouse.
const pointer = () => {
  const dot = document.createElement("div");
  dot.style.cssText =
    "position:fixed;z-index:2147483647;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;" +
    "background:rgba(124,92,255,.55);border:2px solid #fff;pointer-events:none;left:-40px;top:-40px;" +
    "transition:transform .12s";
  addEventListener("DOMContentLoaded", () => document.body.append(dot));
  addEventListener("mousemove", (e) => { dot.style.left = e.clientX + "px"; dot.style.top = e.clientY + "px"; }, true);
  addEventListener("mousedown", () => { dot.style.transform = "scale(.6)"; }, true);
  addEventListener("mouseup", () => { dot.style.transform = ""; }, true);
};

await withBrowser(async (browser) => {
  const storageState = await signIn(browser, setup);
  mkdirSync(out, { recursive: true });

  // The statement whose Pagar button is enabled, found without recording.
  const scout = await browser.newPage({ viewport: size, storageState });
  await scout.goto(base + "/cards");
  await scout.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  const card = await scout.locator('main a[href^="/cards/"]').first().getAttribute("href");
  await scout.goto(base + card);
  await scout.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  const statements = await scout.evaluate(() => [...new Set([...document.querySelectorAll('a[href*="/statements/"]')].map((a) => a.getAttribute("href")))]);
  let statement;
  for (const href of statements.slice(0, 8)) {
    await scout.goto(base + href);
    await scout.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    const pay = scout.getByRole("button", { name: /^Pagar/ }).first();
    if ((await pay.count()) && (await pay.isEnabled())) { statement = href; break; }
  }
  await scout.close();
  console.log("card", card, "statement", statement);
  if (process.env.SCOUT) return;

  for (const scheme of ["dark", "light"]) {
    const context = await browser.newContext({
      viewport: size,
      storageState,
      colorScheme: scheme,
      recordVideo: { dir: out, size },
    });
    const page = await context.newPage();
    await page.addInitScript(pointer);
    const paint = () => page.evaluate((s) => document.documentElement.setAttribute("data-slotted-scheme", s), scheme);
    const reach = async (locator) => {
      const box = await locator.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 28 });
      await page.waitForTimeout(450);
    };
    const press = async (locator) => {
      await reach(locator);
      await locator.click();
      await paint();
      await page.waitForTimeout(1100);
      await paint();
    };
    const started = Date.now();

    await page.goto(base + "/cards");
    await page.locator('main a[href^="/cards/"]').first().waitFor();
    await paint();
    await page.mouse.move(500, 500);
    await page.waitForTimeout(900);
    const lead = Date.now() - started;

    await press(page.locator('main a[href^="/cards/"]').first());
    const link = page.locator(`a[href="${statement}"]`).first();
    await link.scrollIntoViewIfNeeded();
    await press(link);
    await press(page.getByRole("button", { name: /^Pagar/ }).first());
    const dialog = page.getByRole("dialog").last();
    await dialog.waitFor({ timeout: 5000 }).catch(async () => {
      await page.screenshot({ path: `${out}/fail-${scheme}.png` });
    });
    await reach(dialog.getByRole("button", { name: "Em aberto" }));
    await page.waitForTimeout(700);
    const account = dialog.getByRole("button", { name: "Escolher conta" });
    await press(account);
    await press(page.getByRole("option").first());
    await reach(dialog.getByRole("button", { name: /^Pagar fatura/ }));
    await page.waitForTimeout(1500);

    const seconds = (Date.now() - started) / 1000;
    const video = page.video();
    await context.close();
    renameSync(await video.path(), `${out}/pay-statement.${scheme}.webm`);
    console.log(scheme, "seconds", seconds.toFixed(1), "lead ms", lead);
  }
});
