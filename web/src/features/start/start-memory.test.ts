import { beforeEach, describe, expect, it } from "vitest";

import { emptyAccountDraft } from "@/features/accounts";
import { rememberDeviceUser } from "@/features/session";
import { readStart, writeStart } from "@/features/start/start-memory";
import { pending } from "@/features/start/use-start-run";

const key = "equori.start.7";
const kept = "e0000000-0000-4000-8000-000000000001";
const gone = "e0000000-0000-4000-8000-000000000002";

beforeEach(() => {
  localStorage.clear();
  rememberDeviceUser({ id: 1, email: "a@b.c", booksId: 7 });
});

describe("readStart", () => {
  it("keeps a created group whose account exists and resets the others", () => {
    const created = { ...pending, state: "created", accountId: kept };
    writeStart(
      JSON.stringify({
        step: 1,
        rows: [],
        cash: true,
        drafts: [emptyAccountDraft("2026-11-03", "BRL")],
        runs: [
          created,
          { ...pending, state: "created", accountId: gone },
          { ...pending, state: "failed", summary: "The name is taken." },
        ],
      }),
    );

    const state = readStart([kept]);

    expect(state?.step).toBe(1);
    expect(state?.runs).toEqual([created, pending, pending]);
  });

  it.each([
    ["not JSON", "{"],
    [
      "step 3",
      JSON.stringify({ step: 2, rows: [], cash: false, drafts: [], runs: [] }),
    ],
    [
      "a draft without a name",
      JSON.stringify({
        step: 1,
        rows: [],
        cash: false,
        drafts: [{}],
        runs: [],
      }),
    ],
  ])("reads %s as nothing stored", (_, raw) => {
    localStorage.setItem(key, raw);

    expect(readStart([])).toBeNull();
  });

  it("deletes the state on null", () => {
    localStorage.setItem(key, "{}");

    writeStart(null);

    expect(localStorage.getItem(key)).toBeNull();
  });
});
