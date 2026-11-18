// Runs the beats of a tutorial on one page and returns, for each, the still of the page, the
// window of its figure and the place of its mark.
import { RATIO, settle } from "./app.mjs";
import { CLIP, clipAround, markIn, markProblems, regionWidth, union } from "./geometry.mjs";

export async function captureBeats(page, tape, tutorial, { language, scheme }) {
  const words = (pt, en) => (language === "pt" ? pt : en);
  const beats = [];

  await page.goto(tutorial.base + tutorial.open);

  for (const [index, beat] of tutorial.beats.entries()) {
    const what = `${tutorial.id} beat ${index + 1}${beat.figure ? ` (${beat.figure})` : ""}`;
    const at = { page, tape, scheme, beat, words, what };

    // The video shows the whole screen: its still and its mark come from the page as it opens.
    const whole = await place(at);
    const still = await page.screenshot({ type: "png", scale: "device" });
    const figure = beat.figure ? await figureOf(at, whole) : undefined;

    beats.push({
      figure: beat.figure,
      inVideo: beat.only !== "figure",
      clicks: beat.act !== undefined,
      still,
      figureImage: figure?.image,
      figureMark: figure?.mark,
      clip: whole.clip,
      mark: whole.mark,
      size: { width: whole.clip.width * RATIO, height: whole.clip.height * RATIO },
    });

    if (beat.act) await beat.act(page, words);
  }

  if (tape.missed.size > 0) {
    throw new Error(`${tutorial.id}: the tape lacks ${[...tape.missed].join(", ")}; record again`);
  }

  return beats;
}

// The figure of a beat. A frame of its own (a dialog) is cut from the screen as it stands. Any
// other figure is cut from the page region held at the width of a figure: the page reflows as
// it does beside the assistant pane, and the figure shows its whole width at full scale. An
// element that fills the narrowed page, or does not fit in it, is cut from the page as it stands.
async function figureOf(at, whole) {
  const { page, beat } = at;
  const cut = async ({ clip, mark }) => ({
    image: await page.screenshot({ type: "png", scale: "device", clip }),
    mark,
  });

  if (beat.frame) return cut(whole);

  await narrow(page, true);
  const narrowed = await place(at, false);
  const figure = narrowed.problems.length === 0 ? await cut(narrowed) : undefined;
  await narrow(page, false);

  if (figure !== undefined) return figure;

  await place(at);

  return cut(whole);
}

async function narrow(page, on) {
  const region = page.locator("[data-ui='app-shell'] > [data-part='main']");
  const ask = (width) =>
    page.evaluate(
      ([value, set]) => {
        document.documentElement.style.setProperty("--help-figure-width", `${value}px`);
        document.documentElement.toggleAttribute("data-help-figure", set);
      },
      [width, on],
    );

  await ask(CLIP.width);
  if (!on) return;

  const box = await region.boundingBox();
  if (box === null) throw new Error("the application has no page region");

  await ask(regionWidth(box.width));
}

// Brings the target of a beat to rest in view and returns the window of its figure and the
// place of its mark in it.
async function place({ page, tape, scheme, beat, words, what }, strict = true) {
  const targets = beat.target(page, words);

  await boxOf(page, targets, what);
  // A dialog focuses its first field; in a figure that ring would read as a second mark.
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
  await settle(page, tape, scheme);
  await assertOnTop(targets, what);

  const target = await boxOf(page, targets, what);
  // Without a frame of its own, a figure stays inside the page region, clear of the navigation.
  const frameOf = beat.frame ? beat.frame(page, words) : page.locator("main");
  const frame = (await frameOf.first().boundingBox()) ?? undefined;
  const clip = clipAround(target, frame);
  const mark = markIn(target, clip);
  const problems = markProblems(target, clip, mark);
  if (strict && problems.length > 0) throw new Error(`${what}: ${problems.join("; ")}`);

  return { clip, mark, problems };
}

async function boxOf(page, locators, what) {
  const boxes = [];

  for (const locator of [locators].flat()) {
    await locator.first().waitFor({ state: "visible", timeout: 15000 });
    // The centre of the page, clear of a sticky header or footer; the same place on every run.
    await locator.first().evaluate((element) => element.scrollIntoView({ block: "center", inline: "center" }));
  }

  for (const locator of [locators].flat()) {
    const box = await locator.first().boundingBox();
    if (box === null) throw new Error(`${what}: an element has no box`);

    boxes.push(box);
  }

  return union(boxes);
}

// The element under the centre of the target is the target or inside it: nothing covers it.
async function assertOnTop(locators, what) {
  for (const locator of [locators].flat()) {
    const onTop = await locator.first().evaluate((element) => {
      const box = element.getBoundingClientRect();
      const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);

      return hit !== null && (element.contains(hit) || hit.contains(element));
    });

    if (!onTop) throw new Error(`${what}: another element covers the target`);
  }
}
