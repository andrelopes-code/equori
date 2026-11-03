import { afterEach, describe, expect, it, vi } from "vitest";

import { newId } from "@/ui/new-id";

const uuidV4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

describe("newId", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a version 4 UUID where the browser has randomUUID", () => {
    expect(newId()).toMatch(uuidV4);
  });

  it("returns a version 4 UUID in a page without randomUUID, as over plain http", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: crypto.getRandomValues.bind(crypto),
    });

    const first = newId();

    expect(first).toMatch(uuidV4);
    expect(newId()).not.toBe(first);
  });
});
