// The API as a tape: recorded once from the demo book, replayed on every build, so a figure
// depends on the tutorial and on the application code alone, never on the day or on the data of
// the instance that happens to run.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const key = (request) => {
  const url = new URL(request.url());

  return `${request.method()} ${url.pathname}${url.search}`;
};

export function loadTape(path) {
  if (!existsSync(path)) throw new Error(`no tape at ${path}: run "record" first`);

  return JSON.parse(readFileSync(path, "utf8"));
}

// Passes every read to the instance and keeps its answer. A write other than the sign-in is
// refused: a tutorial never changes the book it is recorded from.
export async function recordTape(context, path, clock) {
  const tape = { clock, entries: {} };
  const state = { pending: 0, missed: new Set() };

  await context.route("**/api/**", async (route) => {
    const request = route.request();
    const stream = (request.headers().accept ?? "").includes("text/event-stream");
    const signIn = request.method() === "POST" && /\/(session|login)/.test(request.url());

    if (stream) return route.abort();
    if (request.method() !== "GET" && !signIn) return route.abort();

    state.pending += 1;
    let response, body;
    try {
      response = await route.fetch();
      body = await response.text();
    } finally {
      state.pending -= 1;
    }

    if (request.method() === "GET") {
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
      if (!stream && request.method() === "GET") state.missed.add(key(request));

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
