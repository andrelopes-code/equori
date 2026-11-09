import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const svg =
  '<svg><path fill="white"/><path fill="white" stroke="black"/></svg>';

describe("tintTabIcon", () => {
  beforeEach(() => {
    vi.resetModules();
    document.head.innerHTML = '<link rel="icon" href="/icon.svg">';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("writes the seed into the fill of the icon and fetches once", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(svg)));
    vi.stubGlobal("fetch", fetchMock);
    const { tintTabIcon } = await import("@/theme/tab-icon");

    await tintTabIcon("#10b981");
    await tintTabIcon("#ec4899");

    const href = iconHref();
    expect(href.startsWith("data:image/svg+xml,")).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await tintTabIcon("#10b981");
    const text = decodeURIComponent(
      iconHref().slice("data:image/svg+xml,".length),
    );
    expect(text.match(/fill="#10b981"/g)).toHaveLength(2);
    expect(text.match(/stroke="black"/g)).toHaveLength(1);
  });

  it("keeps the static icon when the fetch rejects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("offline"))),
    );
    const { tintTabIcon } = await import("@/theme/tab-icon");

    await tintTabIcon("#10b981");

    expect(iconHref()).toBe("/icon.svg");
  });

  it("tints with the theme accent while the book accent is suspended", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(svg))),
    );
    localStorage.setItem("equori.accent", "rose");
    localStorage.setItem("equori.bookAccents", '{"7":"emerald"}');
    localStorage.setItem("equori.activeBooks", "7");
    const { repaintAccent } = await import("@/theme/accent");
    const { suspendBookAccent } = await import("@/theme/book-accent");

    suspendBookAccent(true);
    repaintAccent();

    await vi.waitFor(() => {
      expect(decodeURIComponent(iconHref())).toContain('fill="#f43f5e"');
    });
    suspendBookAccent(false);
  });
});

function iconHref(): string {
  return (
    document.head.querySelector("link[rel=icon]")?.getAttribute("href") ?? ""
  );
}
