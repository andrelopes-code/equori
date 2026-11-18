// Runs the beats of a tutorial on one page and returns, for each, the still of the page, the
// window of its figure and the place of its mark.
import { RATIO, settle } from "./app.mjs";
import { clipAround, markIn, markProblems, union } from "./geometry.mjs";

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

export async function captureBeats(page, tape, tutorial, { language, scheme }) {
  const words = (pt, en) => (language === "pt" ? pt : en);
  const beats = [];

  await page.goto(tutorial.base + tutorial.open);

  for (const [index, beat] of tutorial.beats.entries()) {
    const what = `${tutorial.id} beat ${index + 1}${beat.figure ? ` (${beat.figure})` : ""}`;
    const targets = beat.target(page, words);

    await boxOf(page, targets, what);
    // A dialog focuses its first field; in a figure that ring would read as a second mark.
    await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
    await settle(page, tape, scheme);
    await assertOnTop(targets, what);

    const target = await boxOf(page, targets, what);
    // Without a frame of its own, a figure stays inside the page region, clear of the navigation.
    const frameOf = beat.frame ? beat.frame(page, words) : page.locator("main");
    const frameBox = await frameOf.first().boundingBox();
    const frame = frameBox ?? undefined;
    const clip = clipAround(target, frame);
    const mark = markIn(target, clip);
    const problems = markProblems(target, clip, mark);
    if (problems.length > 0) throw new Error(`${what}: ${problems.join("; ")}`);

    const still = await page.screenshot({ type: "png", scale: "device" });
    const figure = beat.figure
      ? await page.screenshot({ type: "png", scale: "device", clip })
      : undefined;

    beats.push({
      figure: beat.figure,
      inVideo: beat.only !== "figure",
      clicks: beat.act !== undefined,
      still,
      figureImage: figure,
      clip,
      mark,
      size: { width: clip.width * RATIO, height: clip.height * RATIO },
    });

    if (beat.act) await beat.act(page, words);
  }

  if (tape.missed.size > 0) {
    throw new Error(`${tutorial.id}: the tape lacks ${[...tape.missed].join(", ")}; record again`);
  }

  return beats;
}
