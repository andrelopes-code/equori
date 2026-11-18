// The one way a figure or a video of the help is made (docs/contributing/help-media.md).
//   node run.mjs record [tutorial]   sign in to the demo book and record its answers on tape
//   node run.mjs build  [tutorial]   replay the tape, capture, mark, compose, check, write
//   node run.mjs check               check the written media without a browser
//   node run.mjs review              write out/review.html: every figure under its mark, every video
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const MEDIA = join(here, "../../web/src/features/help/media");
const CONTENT = join(here, "../../web/src/features/help/content");
const MANIFEST = join(MEDIA, "media.json");
// The instance the tape is recorded from (make demo, make run-dev). A build needs none.
const LIVE = process.env.HELP_MEDIA_BASE ?? "http://127.0.0.1:5173";
const DIST = join(here, "../../web/dist");
const SIZE = { width: 1280, height: 800 };
const MAX_VIDEO_BYTES = 2_500_000;

const [command, only] = process.argv.slice(2);

const sha = (buffer) => createHash("sha256").update(buffer).digest("hex");

async function tutorials(base) {
  const files = readdirSync(join(here, "tutorials")).filter((f) => f.endsWith(".mjs"));
  const all = await Promise.all(files.map(async (f) => (await import(join(here, "tutorials", f))).default));

  return all.filter((t) => only === undefined || t.id === only).map((t) => ({ ...t, base }));
}

const tapePath = (id) => join(here, "tutorials", `${id}.tape.json`);

async function record() {
  const { openApp, settle, withBrowser } = await import("./lib/app.mjs");
  const { recordTape } = await import("./lib/tape.mjs");
  const { captureBeats } = await import("./lib/capture.mjs");

  await withBrowser(async (browser) => {
    for (const tutorial of await tutorials(LIVE)) {
      const clock = `${new Date().toISOString().slice(0, 10)}T15:00:00.000Z`;
      const { context, page } = await openApp(browser, { language: "pt", scheme: "dark", clock });
      const tape = await recordTape(context, tapePath(tutorial.id), clock);

      await page.goto(`${LIVE}/login`);
      await page.locator('input[type="email"]').fill(process.env.HELP_MEDIA_USER ?? "demo@equori.local");
      await page.locator('input[type="password"]').fill(process.env.HELP_MEDIA_PASSWORD ?? "equori-demo-account");
      await page.locator('button[type="submit"]').click();
      await page.waitForURL((url) => !url.pathname.startsWith("/login"));
      await settle(page, tape.state, "dark");
      await captureBeats(page, tape.state, tutorial, { language: "pt", scheme: "dark" });
      tape.save();
      await context.close();
      console.log(`recorded ${tutorial.id}`);
    }
  });
}

async function build() {
  const { LANGUAGES, SCHEMES, openApp, withBrowser } = await import("./lib/app.mjs");
  const { loadTape, replayTape } = await import("./lib/tape.mjs");
  const { captureBeats } = await import("./lib/capture.mjs");
  const { percent } = await import("./lib/geometry.mjs");
  const { renderVideo } = await import("./lib/video.mjs");
  const { serveBuild } = await import("./lib/serve.mjs");
  const served = await serveBuild(DIST);
  const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};
  const next = { figures: { ...manifest.figures }, videos: { ...manifest.videos }, files: { ...manifest.files } };

  mkdirSync(join(here, "out"), { recursive: true });

  await withBrowser(async (browser) => {
    for (const tutorial of await tutorials(served.base)) {
      const tape = loadTape(tapePath(tutorial.id));

      for (const language of LANGUAGES) {
        const spots = {};

        for (const scheme of SCHEMES) {
          const { context, page } = await openApp(browser, { language, scheme, clock: tape.clock });
          const state = await replayTape(context, tape, { language, scheme });
          const beats = await captureBeats(page, state, tutorial, { language, scheme });
          const accent = await page.evaluate(() => {
            const probe = document.createElement("i");
            probe.style.color = "var(--slotted-tone-accent-solid)";
            document.body.append(probe);
            const colour = getComputedStyle(probe).color;
            probe.remove();

            return colour;
          });
          await context.close();

          for (const beat of beats.filter((b) => b.figure)) {
            const spot = percent(beat.mark);
            const name = `${beat.figure}.${language}.${scheme}.png`;

            // The mark is one per language: a scheme that moves an element is a defect of the app.
            if (spots[beat.figure] && spots[beat.figure].join() !== spot.join()) {
              throw new Error(`${name}: the mark differs between schemes`);
            }

            spots[beat.figure] = spot;
            writeFileSync(join(MEDIA, name), beat.figureImage);
            next.files[name] = sha(beat.figureImage);
            next.figures[beat.figure] = { ...next.figures[beat.figure], [language]: { spot } };
          }

          if (tutorial.video) {
            const name = `${tutorial.id}.${language}.${scheme}.webm`;
            const video = await renderVideo(browser, beats, accent, join(MEDIA, name));
            const bytes = readFileSync(join(MEDIA, name));

            if (bytes.length > MAX_VIDEO_BYTES) throw new Error(`${name}: ${bytes.length} bytes, above the limit`);

            next.files[name] = sha(bytes);
            next.videos[tutorial.id] = { seconds: video.seconds, frames: video.frames };
          }

          console.log(`built ${tutorial.id} ${language} ${scheme}`);
        }
      }
    }
  });

  await served.close();
  // The form the formatter of the repository keeps: a list of numbers on one line.
  const text = JSON.stringify(next, null, 2).replace(
    /\[\s+([-\d.,\s]+?)\s+\]/g,
    (_, body) => `[${body.split(/,\s*/).join(", ")}]`,
  );
  writeFileSync(MANIFEST, `${text}\n`);
  check();
}

// The figures a page names, read from its Markdown: ![alt](id) and ![alt](id.webm).
function named(language) {
  const dir = join(CONTENT, language);
  const ids = { figures: new Set(), videos: new Set() };

  for (const file of readdirSync(dir)) {
    for (const [, id] of readFileSync(join(dir, file), "utf8").matchAll(/!\[[^\]]*\]\(([^\s)]+)/g)) {
      if (id.endsWith(".webm")) ids.videos.add(id.slice(0, -5));
      else ids.figures.add(id);
    }
  }

  return ids;
}

function check() {
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const problems = [];
  const file = (name) => {
    const path = join(MEDIA, name);
    if (!existsSync(path)) return problems.push(`${name}: missing`), null;

    const bytes = readFileSync(path);
    if (manifest.files[name] !== sha(bytes)) problems.push(`${name}: differs from the manifest; build again`);

    return bytes;
  };

  for (const language of ["pt", "en"]) {
    const ids = named(language);

    for (const id of ids.figures) {
      const spot = manifest.figures[id]?.[language]?.spot;
      if (!spot) {
        problems.push(`${id}: no mark for ${language}`);
        continue;
      }

      const [x, y, width, height] = spot;
      if (x < 2.5 || y < 4 || x + width > 97.5 || y + height > 96) problems.push(`${id} ${language}: the mark leaves the figure`);

      for (const scheme of ["dark", "light"]) {
        const png = file(`${id}.${language}.${scheme}.png`);
        if (png && (png.readUInt32BE(16) !== SIZE.width || png.readUInt32BE(20) !== SIZE.height)) {
          problems.push(`${id}.${language}.${scheme}.png: not ${SIZE.width}x${SIZE.height}`);
        }
      }
    }

    for (const id of ids.videos) {
      const video = manifest.videos[id];
      if (!video || video.frames !== Math.round(video.frames / 30) * 30 && video.frames < 240) problems.push(`${id}: no video entry`);
      for (const scheme of ["dark", "light"]) file(`${id}.${language}.${scheme}.webm`);
    }
  }

  const known = new Set(Object.keys(manifest.files));
  for (const name of readdirSync(MEDIA).filter((f) => /\.(png|webm)$/.test(f))) {
    if (!known.has(name)) problems.push(`${name}: not made by this tool`);
  }

  if (problems.length > 0) {
    console.error(problems.join("\n"));
    process.exit(1);
  }

  console.log(`help media: ${known.size} files checked`);
}

// A page with every figure under its mark, placed as the application places it, and every video:
// what a person reads before the media is committed.
function review() {
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const figures = Object.entries(manifest.figures).flatMap(([id, languages]) =>
    Object.entries(languages).flatMap(([language, { spot }]) =>
      ["dark", "light"].map(
        (scheme) =>
          `<figure><div class="shot"><img src="${MEDIA}/${id}.${language}.${scheme}.png">` +
          `<i style="left:${spot[0]}%;top:${spot[1]}%;width:${spot[2]}%;height:${spot[3]}%"><b>n</b></i></div>` +
          `<figcaption>${id} · ${language} · ${scheme}</figcaption></figure>`,
      ),
    ),
  );
  const videos = Object.keys(manifest.files)
    .filter((name) => name.endsWith(".webm"))
    .map((name) => `<figure><video src="${MEDIA}/${name}" controls muted></video><figcaption>${name}</figcaption></figure>`);

  mkdirSync(join(here, "out"), { recursive: true });
  writeFileSync(
    join(here, "out/review.html"),
    `<!doctype html><meta charset="utf-8"><title>Help media review</title><style>
body{margin:16px;background:#777;font:12px system-ui;display:grid;grid-template-columns:repeat(2,640px);gap:16px}
figure{margin:0}.shot{position:relative;width:640px;height:400px;overflow:hidden;border-radius:10px}
img,video{display:block;width:640px}i{position:absolute;border-radius:8px;outline:2px solid #7c5cff;box-shadow:0 0 0 1600px rgba(0,0,0,.45)}
b{position:absolute;left:-10.5px;top:-10.5px;width:21px;height:21px;border-radius:50%;background:#7c5cff;color:#fff;display:grid;place-items:center;font-style:normal}
</style>${figures.join("")}${videos.join("")}`,
  );
  console.log(join(here, "out/review.html"));
}

if (command === "record") await record();
else if (command === "build") await build();
else if (command === "check") check();
else if (command === "review") review();
else {
  console.error("usage: node run.mjs record|build|check|review [tutorial]");
  process.exit(2);
}
