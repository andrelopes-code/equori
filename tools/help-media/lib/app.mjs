// One browser page of the application in a fixed state: size, pixel ratio, language, scheme,
// clock and motion are set here and nowhere else.
import { chromium } from "playwright";

export const VIEW = { width: 1280, height: 800 };
// Every capture holds two device pixels per CSS pixel, so it stays sharp on a dense screen.
export const RATIO = 2;
export const LANGUAGES = ["pt", "en"];
export const SCHEMES = ["dark", "light"];

const STILL = `
  *, *::before, *::after {
    transition: none !important;
    animation: none !important;
    scroll-behavior: auto !important;
    caret-color: transparent !important;
  }
  ::-webkit-scrollbar { display: none !important; }
  /* The page region at the width of a figure, as it stands beside the assistant pane. */
  html[data-help-figure] [data-ui="app-shell"] > [data-part="main"] {
    max-width: var(--help-figure-width) !important;
  }
`;

export async function withBrowser(run) {
  const browser = await chromium.launch();

  try {
    return await run(browser);
  } finally {
    await browser.close();
  }
}

export async function openApp(browser, { language, scheme, clock }) {
  const context = await browser.newContext({
    viewport: VIEW,
    deviceScaleFactor: RATIO,
    locale: language === "pt" ? "pt-BR" : "en-US",
    timezoneId: "America/Sao_Paulo",
    colorScheme: scheme,
    reducedMotion: "reduce",
    // The worker of the application caches its shell; a capture reads the build as served.
    serviceWorkers: "block",
  });

  await context.addInitScript(
    ({ language, scheme, css }) => {
      localStorage.setItem("equori.locale", JSON.stringify({ language, region: "BR" }));
      localStorage.setItem("equori.scheme", scheme);
      addEventListener("DOMContentLoaded", () => {
        const style = document.createElement("style");
        style.textContent = css;
        document.head.append(style);
      });
    },
    { language, scheme, css: STILL },
  );

  const page = await context.newPage();
  await page.clock.setFixedTime(new Date(clock));

  return { context, page };
}

// A frame is taken only when the page stopped changing: fonts loaded, no answer on its way, the
// scheme in force, and two captures in a row equal byte for byte.
export async function settle(page, tape, scheme) {
  await page.evaluate(() => document.fonts.ready);

  let last = null;
  for (let attempt = 0; attempt < 40; attempt++) {
    await page.waitForTimeout(120);
    if (tape.pending > 0) {
      last = null;
      continue;
    }

    const now = await page.evaluate(() => document.documentElement.getAttribute("data-slotted-scheme"));
    if (now !== scheme) throw new Error(`scheme is ${now}, expected ${scheme}`);

    const shot = await page.screenshot({ scale: "css", type: "png" });
    if (last !== null && shot.equals(last)) return;

    last = shot;
  }

  throw new Error("the page did not come to rest in 5 s");
}
