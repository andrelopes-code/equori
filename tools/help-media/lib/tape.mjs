// The API as a tape: recorded once from the demo book, replayed on every build, so a figure
// depends on the tutorial and on the application code alone, never on the day or on the data of
// the instance that happens to run.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

export function loadTape(path) {
  if (!existsSync(path)) throw new Error(`no tape at ${path}: run "record" first`);

  return JSON.parse(readFileSync(path, "utf8"));
}

// Passes every read to the instance and keeps its answer. A write other than the sign-in is
// refused: a tutorial never changes the book it is recorded from. A tutorial declares in `reads`
// the requests with a body that change nothing (a preview); each is kept under its body.
export async function recordTape(context, path, clock, reads = []) {
  const tape = { clock, reads, entries: {} };
  const state = { pending: 0, missed: new Set() };

  await context.route("**/api/**", async (route) => {
    const request = route.request();
    const stream = (request.headers().accept ?? "").includes("text/event-stream");

    if (stream || !passes(request, reads)) return route.abort();

    state.pending += 1;
    let response, body;
    try {
      response = await route.fetch();
      body = await response.text();
    } finally {
      state.pending -= 1;
    }

    if (!signIn(request)) {
      tape.entries[key(request)] = {
        status: response.status(),
        type: response.headers()["content-type"] ?? "application/json",
        body,
      };
    }

    return route.fulfill({ response, body });
  });

  return { state, save: () => writeFileSync(path, `${JSON.stringify(tape, null, 1)}\n`) };
}

// Answers from the tape. A request the tape lacks is refused and reported: the build fails on it.
// The answers that carry a preference of the recorded account are rewritten: a figure shows the
// application as it ships, in the language and scheme of its variant, whatever the account chose.
function bodyFor(path, entry, { language, scheme }) {
  if (path === "GET /api/v1/me/appearance") return JSON.stringify({ scheme });
  if (path === "GET /api/v1/me") return JSON.stringify({ ...JSON.parse(entry.body), language });

  return entry.body;
}

export async function replayTape(context, tape, variant) {
  const state = { pending: 0, missed: new Set() };

  await context.route("**/api/**", async (route) => {
    const request = route.request();
    const entry = tape.entries[key(request)];
    const stream = (request.headers().accept ?? "").includes("text/event-stream");

    if (entry === undefined) {
      // A write is refused in silence: the application saves preferences on its own.
      if (!stream && !signIn(request) && passes(request, tape.reads ?? [])) state.missed.add(key(request));

      return route.abort();
    }

    state.pending += 1;
    try {
      await route.fulfill({
        status: entry.status,
        contentType: entry.type,
        body: bodyFor(key(request), entry, variant),
      });
    } finally {
      state.pending -= 1;
    }
  });

  return state;
}

// The name of a request on the tape: its method, path and query, and for a request with a body
// the hash of the body, so the answer to one preview never serves another.
export function key(request) {
  const url = new URL(request.url());
  const name = `${request.method()} ${url.pathname}${url.search}`;
  const body = request.postData();

  if (request.method() === "GET" || body === null) return name;

  return `${name} ${createHash("sha256").update(body).digest("hex")}`;
}

// What reaches the instance during a recording: a read, the sign-in, and a read with a body
// that the tutorial declares.
export function passes(request, reads) {
  if (request.method() === "GET" || signIn(request)) return true;

  return reads.includes(`${request.method()} ${new URL(request.url()).pathname}`);
}

function signIn(request) {
  return request.method() === "POST" && /\/(session|login)/.test(request.url());
}
