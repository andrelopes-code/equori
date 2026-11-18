// The one way a figure or a video of the help is made (docs/contributing/help.md, ADR 037).
//   node run.mjs record [tutorial]   sign in to the demo book and record its answers on tape
//   node run.mjs build  [tutorial]   replay the tape, capture, mark, compose, check, write;
//                                    a tutorial whose inputs did not change is skipped (--force builds it)
//   node run.mjs check               check the written media without a browser
//   node run.mjs review              write out/review.html: every figure under its mark, every video
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { LANGUAGES, SCHEMES } from "./lib/variants.mjs";
import { stillName, timeline, timelineProblems } from "./lib/video.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const MEDIA = join(here, "../../web/src/features/help/media");
const CONTENT = join(here, "../../web/src/features/help/content");
const MANIFEST = join(MEDIA, "media.json");
const MODULE = join(MEDIA, "help-media-files.gen.ts");
// The instance the tape is recorded from (make demo, make run-dev). A build needs none.
const LIVE = process.env.HELP_MEDIA_BASE ?? "http://127.0.0.1:5173";
const DIST = join(here, "../../web/dist");
const SIZE = { width: 1920, height: 1200 };
// A still of the video: the whole screen at two device pixels per CSS pixel.
const STILL = { width: 3840, height: 2400 };
// The layout guard holds a folder of web/src under 40 files (internal/platform/layout).
const FOLDER_FILES = 40;
// The pack above which ADR 037 is reopened (amendment of 2026-11-18, consequence on the weight).
const PACK_CEILING = 3 * 2 ** 30;
// The compositor the help page draws the video with; the review page runs the same code.
const COMPOSITOR = join(here, "../../web/src/features/help/video");
// Variants built at once; each takes part of one core for its page.
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
      // A tutorial built again keeps no file of an earlier build: its folder is written anew.
      for (const name of Object.keys(next.files).filter((f) => f.startsWith(`${tutorial.id}/`))) {
        delete next.files[name];
      }

      delete next.videos[tutorial.id];
      rmSync(join(MEDIA, tutorial.id), { recursive: true, force: true });
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
        const shown = beats.filter((b) => b.inVideo);
        const stills = shown.map((beat) => stillName(tutorial.id, beat.still));

        // A still equal to another, in this language or another, is one file.
        for (const [index, name] of stills.entries()) {
          if (next.files[name] !== undefined) continue;

          writeFileSync(join(MEDIA, name), shown[index].still);
          next.files[name] = sha(shown[index].still);
        }

        next.videos[tutorial.id] = {
          ...next.videos[tutorial.id],
          [language]: { ...timeline(beats), stills, accent },
        };
      }

      console.log(`built ${tutorial.id} ${language} ${scheme}`);
    };

    // The variants are independent: each has its own page.
    const workers = Array.from({ length: Math.min(JOBS, jobs.length) }, async () => {
      for (let job = jobs.shift(); job !== undefined; job = jobs.shift()) await one(job);
    });
    await Promise.all(workers);
  });

  await served.close();
  // The order of the variants does not depend on which one finished first.
  next.files = Object.fromEntries(Object.entries(next.files).sort(([a], [b]) => a.localeCompare(b)));
  for (const [id, video] of Object.entries(next.videos)) {
    next.videos[id] = Object.fromEntries(LANGUAGES.filter((l) => video[l]).map((l) => [l, video[l]]));
  }

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
  // A figure is found by its name; a still by its folder too, since two tutorials can hold the
  // same still under the same hash.
  const stills = new Set(Object.values(manifest.videos).flatMap((v) => Object.values(v).flatMap((e) => e.stills)));
  const imports = names.map((name, index) => `import f${index} from "./${name}?url";`);
  const entries = names.map((name, index) => `  "${stills.has(name) ? name : basename(name)}": f${index},`);

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

// The figures a page names, read from its Markdown: ![alt](id) and ![alt](id.video).
function named(language) {
  const dir = join(CONTENT, language);
  const ids = { figures: new Set(), videos: new Set() };

  for (const file of readdirSync(dir)) {
    for (const [, id] of readFileSync(join(dir, file), "utf8").matchAll(/!\[[^\]]*\]\(([^\s)]+)/g)) {
      if (id.endsWith(".video")) ids.videos.add(id.slice(0, -".video".length));
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
      const video = manifest.videos[id]?.[language];
      if (!video) {
        problems.push(`${id}: no video for ${language}`);
        continue;
      }

      problems.push(...timelineProblems(`${id} ${language}`, video));
      for (const name of video.stills) problems.push(...stillProblems(manifest, name));
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

  const counts = Map.groupBy(found, (name) => dirname(name));
  for (const [folder, names] of counts) {
    if (names.length > FOLDER_FILES) problems.push(`${folder}: ${names.length} files, more than ${FOLDER_FILES}`);
  }

  const bytes = [...known].reduce((sum, name) => sum + (existsSync(join(MEDIA, name)) ? statSync(join(MEDIA, name)).size : 0), 0);

  if (problems.length > 0) {
    console.error(problems.join("\n"));
    process.exit(1);
  }

  console.log(`help media: ${known.size} files checked, ${(bytes / 1e6).toFixed(1)} MB`);
  printPack();
}

// A still of a video: written by this tool, named by its own hash, at the size of the screen.
function stillProblems(manifest, name) {
  const path = join(MEDIA, name);
  if (!existsSync(path)) return [`${name}: missing`];

  const png = readFileSync(path);
  const problems = [];
  if (manifest.files[name] !== sha(png)) problems.push(`${name}: differs from the manifest; build again`);
  if (stillName(dirname(name), png) !== name) problems.push(`${name}: not named by its hash`);
  if (png.readUInt32BE(16) !== STILL.width || png.readUInt32BE(20) !== STILL.height) {
    problems.push(`${name}: not ${STILL.width}x${STILL.height}`);
  }

  return problems;
}

// The weight of the repository the media lives in (ADR 037, amendment of 2026-11-18). It never
// fails the check: a pack past the ceiling reopens the decision, it does not block a commit.
function printPack() {
  let output;
  try {
    output = execFileSync("git", ["count-objects", "-v"], { cwd: here, encoding: "utf8" });
  } catch {
    console.log("repository pack: not a git checkout");
    return;
  }

  const kib = Number(/^size-pack: (\d+)$/m.exec(output)?.[1] ?? 0);
  console.log(`repository pack: ${(kib / 2 ** 20).toFixed(2)} GiB (git count-objects -v)`);
  if (kib * 1024 > PACK_CEILING) {
    console.log("repository pack above 3 GiB: reopen ADR 037, amendment of 2026-11-18 (media in Git)");
  }
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
  const videos = Object.entries(manifest.videos).flatMap(([id, languages]) =>
    Object.keys(languages).map(
      (language) =>
        `<figure><canvas width="3840" height="2400" data-video="${id}" data-language="${language}"></canvas>` +
        `<figcaption>${id} · ${language}</figcaption></figure>`,
    ),
  );

  mkdirSync(join(here, "out"), { recursive: true });
  writeFileSync(
    join(here, "out/review.html"),
    `<!doctype html><meta charset="utf-8"><title>Help media review</title><style>
@font-face{font-family:"Geist Variable";src:url(${geist()})}
body{margin:16px;background:#777;font:12px system-ui;display:grid;grid-template-columns:repeat(2,640px);gap:16px}
figure{margin:0}.shot{position:relative;width:640px;height:400px;overflow:hidden;border-radius:10px}
img,canvas{display:block;width:640px}i{position:absolute;border-radius:8px;outline:2px solid #7c5cff;box-shadow:0 0 0 1600px rgba(0,0,0,.45)}
b{position:absolute;left:-10.5px;top:-10.5px;width:21px;height:21px;border-radius:50%;background:#7c5cff;color:#fff;display:grid;place-items:center;font-style:normal}
</style>${figures.join("")}${videos.join("")}<script type="module">${compositor()}
${playVideos(manifest)}</script>`,
  );
  console.log(join(here, "out/review.html"));
}

// The compositor of the help page, its types stripped and its imports dropped, in one script:
// the review plays the video with the code of the application and keeps no copy of it.
function compositor() {
  return ["compose-frame.ts", "draw-frame.ts"]
    .map((file) => stripTypeScriptTypes(readFileSync(join(COMPOSITOR, file), "utf8")))
    .join("\n")
    .replace(/^import[^;]*;$/gm, "")
    .replace(/^export /gm, "");
}

// The font of the application, from its build, for the number of the mark.
function geist() {
  const assets = join(DIST, "assets");
  const file = existsSync(assets) ? readdirSync(assets).find((f) => /^geist-latin-wght-normal-.*\.woff2$/.test(f)) : undefined;

  return file === undefined ? "" : join(assets, file);
}

// Each canvas of the review plays its video in a loop, from the stills of the manifest.
function playVideos(manifest) {
  return `const videos = ${JSON.stringify(manifest.videos)};
const media = ${JSON.stringify(MEDIA)};
const font = '"Geist Variable", ui-sans-serif, sans-serif';
await document.fonts.load('600 22px "Geist Variable"');
for (const canvas of document.querySelectorAll("canvas[data-video]")) {
  const video = videos[canvas.dataset.video][canvas.dataset.language];
  const stills = await Promise.all(video.stills.map(async (name) => {
    const image = new Image(); image.src = media + "/" + name; await image.decode(); return image;
  }));
  const ctx = canvas.getContext("2d");
  const begun = performance.now();
  const tick = (now) => {
    const t = ((now - begun) / 1000) % video.duration;
    drawFrame(ctx, stills, frameAt(video, t), { accent: video.accent, font });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}`;
}

if (command === "record") await record();
else if (command === "build") await build();
else if (command === "check") check();
else if (command === "review") review();
else {
  console.error("usage: node run.mjs record|build|check|review [tutorial]");
  process.exit(2);
}
