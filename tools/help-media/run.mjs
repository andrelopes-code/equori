// The one way a figure or a video of the help is made (docs/contributing/help.md, ADR 037).
//   node run.mjs record [tutorial]   sign in to the demo book and record its answers on tape
//   node run.mjs build  [tutorial]   replay the tape, capture, mark, compose, check, write;
//                                    a tutorial whose inputs did not change is skipped (--force builds it)
//   node run.mjs check               check the written media without a browser
//   node run.mjs review              write out/review.html: every figure under its mark, every video
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { LANGUAGES, SCHEMES } from "./lib/variants.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const MEDIA = join(here, "../../web/src/features/help/media");
const CONTENT = join(here, "../../web/src/features/help/content");
const MANIFEST = join(MEDIA, "media.json");
const MODULE = join(MEDIA, "help-media-files.gen.ts");
// The instance the tape is recorded from (make demo, make run-dev). A build needs none.
const LIVE = process.env.HELP_MEDIA_BASE ?? "http://127.0.0.1:5173";
const DIST = join(here, "../../web/dist");
const SIZE = { width: 1920, height: 1200 };
// Variants built at once; each takes one core for its encoder and part of one for its page.
const JOBS = Number(process.env.HELP_MEDIA_JOBS ?? 4);
const FORCE = process.argv.includes("--force");

// A tutorial keeps its files in a folder of its own: the layout guard holds a folder of web/src
// under 40 files. The manifest names a file by that folder and its name.
const placed = (tutorial, name) => `${tutorial.id}/${name}`;

const [command, only] = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));

const sha = (buffer) => createHash("sha256").update(buffer).digest("hex");

function filesUnder(dir) {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .sort();
}

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
      const tape = await recordTape(context, tapePath(tutorial.id), clock, tutorial.reads);

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
  const { openApp, withBrowser } = await import("./lib/app.mjs");
  const { loadTape, replayTape } = await import("./lib/tape.mjs");
  const { captureBeats } = await import("./lib/capture.mjs");
  const { percent } = await import("./lib/geometry.mjs");
  const { renderVideo } = await import("./lib/video.mjs");
  const { serveBuild } = await import("./lib/serve.mjs");
  const served = await serveBuild(DIST);
  const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};
  const next = { figures: { ...manifest.figures }, videos: { ...manifest.videos }, files: { ...manifest.files } };

  mkdirSync(join(here, "out"), { recursive: true });

  // What a tutorial is built from: the build of the application, the tutorial, its tape, the
  // tool and the pages. Unchanged inputs give the same files, so the tutorial is not built again.
  const common = sha(
    [...filesUnder(DIST), ...filesUnder(join(here, "lib")), ...filesUnder(CONTENT), join(here, "run.mjs")]
      .map((path) => sha(readFileSync(path)))
      .join(""),
  );
  next.inputs = { ...manifest.inputs };

  await withBrowser(async (browser) => {
    const jobs = [];

    for (const tutorial of await tutorials(served.base)) {
      const tape = loadTape(tapePath(tutorial.id));
      const inputs = sha(
        common + sha(readFileSync(tapePath(tutorial.id))) + sha(readFileSync(join(here, "tutorials", `${tutorial.id}.mjs`))),
      );

      if (!FORCE && manifest.inputs?.[tutorial.id] === inputs) {
        console.log(`unchanged ${tutorial.id}`);
        continue;
      }

      next.inputs[tutorial.id] = inputs;
      mkdirSync(join(MEDIA, tutorial.id), { recursive: true });
      for (const language of LANGUAGES) for (const scheme of SCHEMES) jobs.push({ tutorial, tape, language, scheme });
    }

    const spots = {};
    const one = async ({ tutorial, tape, language, scheme }) => {
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
        const spot = percent(beat.figureMark);
        const name = `${beat.figure}.${language}.${scheme}.png`;
        const key = `${beat.figure}.${language}`;

        // The mark is one per language: a scheme that moves an element is a defect of the app.
        if (spots[key] && spots[key].join() !== spot.join()) {
          throw new Error(`${name}: the mark differs between schemes`);
        }

        spots[key] = spot;
        writeFileSync(join(MEDIA, placed(tutorial, name)), beat.figureImage);
        next.files[placed(tutorial, name)] = sha(beat.figureImage);
        next.figures[beat.figure] = { ...next.figures[beat.figure], [language]: { spot } };
      }

      if (tutorial.video) {
        const name = `${tutorial.id}.${language}.${scheme}.webm`;
        const video = await renderVideo(browser, beats, accent, join(MEDIA, placed(tutorial, name)));
        const bytes = readFileSync(join(MEDIA, placed(tutorial, name)));

        next.files[placed(tutorial, name)] = sha(bytes);
        next.videos[tutorial.id] = { seconds: video.seconds, frames: video.frames };
      }

      console.log(`built ${tutorial.id} ${language} ${scheme}`);
    };

    // The variants are independent: each has its own page and its own encoder.
    const workers = Array.from({ length: Math.min(JOBS, jobs.length) }, async () => {
      for (let job = jobs.shift(); job !== undefined; job = jobs.shift()) await one(job);
    });
    await Promise.all(workers);
  });

  await served.close();
  // The form the formatter of the repository keeps: a list of numbers on one line.
  const text = JSON.stringify(next, null, 2).replace(
    /\[\s+([-\d.,\s]+?)\s+\]/g,
    (_, body) => `[${body.split(/,\s*/).join(", ")}]`,
  );
  writeFileSync(MANIFEST, `${text}\n`);
  writeFileSync(MODULE, moduleOf(next));
  check();
}

// The module the application reads the address of each file from. A list written here changes
// with the files; a pattern read by the bundler does not, and a cached transform of it keeps the
// files of an earlier build.
function moduleOf(manifest) {
  const names = Object.keys(manifest.files).sort();
  const imports = names.map((name, index) => `import f${index} from "./${name}?url";`);
  const entries = names.map((name, index) => `  "${basename(name)}": f${index},`);

  return [
    "// Written by tools/help-media (docs/contributing/help.md). Never edited by hand.",
    ...imports,
    "",
    "export const helpMediaFiles: Partial<Record<string, string>> = {",
    ...entries,
    "};",
    "",
  ].join("\n");
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
  const folders = foldersOf(manifest);
  const file = (base) => {
    const name = folders[base] ?? base;
    const path = join(MEDIA, name);
    if (!existsSync(path)) return problems.push(`${name}: missing`), null;

    const bytes = readFileSync(path);
    if (manifest.files[name] !== sha(bytes)) problems.push(`${name}: differs from the manifest; build again`);

    return bytes;
  };

  for (const language of LANGUAGES) {
    const ids = named(language);

    for (const id of ids.figures) {
      const spot = manifest.figures[id]?.[language]?.spot;
      if (!spot) {
        problems.push(`${id}: no mark for ${language}`);
        continue;
      }

      const [x, y, width, height] = spot;
      if (x < 0 || y < 0 || x + width > 100 || y + height > 100) problems.push(`${id} ${language}: the mark leaves the figure`);

      for (const scheme of SCHEMES) {
        const png = file(`${id}.${language}.${scheme}.png`);
        if (png && (png.readUInt32BE(16) !== SIZE.width || png.readUInt32BE(20) !== SIZE.height)) {
          problems.push(`${id}.${language}.${scheme}.png: not ${SIZE.width}x${SIZE.height}`);
        }
      }
    }

    for (const id of ids.videos) {
      const video = manifest.videos[id];
      if (!video || video.frames !== Math.round(video.frames / 30) * 30 && video.frames < 240) problems.push(`${id}: no video entry`);
      for (const scheme of SCHEMES) file(`${id}.${language}.${scheme}.webm`);
    }
  }

  if (!existsSync(MODULE) || readFileSync(MODULE, "utf8") !== moduleOf(manifest)) {
    problems.push("help-media-files.gen.ts: differs from the manifest; build again");
  }

  const known = new Set(Object.keys(manifest.files));
  // The folder holds the manifest and the two modules that read it; any other file is media.
  const found = filesUnder(MEDIA).map((path) => relative(MEDIA, path).replaceAll("\\", "/"));
  for (const name of found.filter((f) => f.includes("/") || !/\.(json|ts)$/.test(f))) {
    if (!known.has(name)) problems.push(`${name}: not made by this tool`);
  }

  const bytes = [...known].reduce((sum, name) => sum + (existsSync(join(MEDIA, name)) ? statSync(join(MEDIA, name)).size : 0), 0);

  if (problems.length > 0) {
    console.error(problems.join("\n"));
    process.exit(1);
  }

  console.log(`help media: ${known.size} files checked, ${(bytes / 1e6).toFixed(1)} MB`);
}

// The place of each file in the folder of the media, by its name.
function foldersOf(manifest) {
  return Object.fromEntries(Object.keys(manifest.files).map((name) => [basename(name), name]));
}

// A page with every figure under its mark, placed as the application places it, and every video:
// what a person reads before the media is committed.
function review() {
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const folders = foldersOf(manifest);
  const figures = Object.entries(manifest.figures).flatMap(([id, languages]) =>
    Object.entries(languages).flatMap(([language, { spot }]) =>
      SCHEMES.map(
        (scheme) =>
          `<figure><div class="shot"><img src="${MEDIA}/${folders[`${id}.${language}.${scheme}.png`]}">` +
          `<i style="left:${spot[0]}%;top:${spot[1]}%;width:${spot[2]}%;height:${spot[3]}%"><b>n</b></i></div>` +
          `<figcaption>${id} · ${language} · ${scheme}</figcaption></figure>`,
      ),
    ),
  );
  const videos = Object.keys(manifest.files)
    .filter((name) => name.endsWith(".webm"))
    .map((name) => `<figure><video src="${MEDIA}/${name}" controls muted></video><figcaption>${basename(name)}</figcaption></figure>`);

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
