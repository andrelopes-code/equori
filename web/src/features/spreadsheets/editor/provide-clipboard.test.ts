import { afterEach, describe, expect, it, vi } from "vitest";

import { provideClipboard } from "@/features/spreadsheets/editor/provide-clipboard";

describe("provideClipboard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("gives a page without a clipboard a writeText that copies by selection", async () => {
    let copied = "";
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: () => {
        copied = document.querySelector("textarea")?.value ?? "";
        return true;
      },
    });
    vi.stubGlobal("isSecureContext", false);
    vi.stubGlobal("navigator", {});

    provideClipboard();
    await navigator.clipboard.writeText("http://192.168.1.10/#gid=1");

    expect(copied).toBe("http://192.168.1.10/#gid=1");
  });

  it("offers no reading, so the editor keeps its own copy and paste of cells", () => {
    vi.stubGlobal("navigator", {});

    provideClipboard();

    expect("readText" in navigator.clipboard).toBe(false);
    expect("write" in navigator.clipboard).toBe(false);
  });

  it("keeps the clipboard of the browser", () => {
    const clipboard = { writeText: vi.fn() };
    vi.stubGlobal("navigator", { clipboard });

    provideClipboard();

    expect(navigator.clipboard).toBe(clipboard);
  });
});
