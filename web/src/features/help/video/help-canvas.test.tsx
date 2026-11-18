import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { HelpVideoMedia } from "@/features/help/media/help-media";
import { HelpCanvas } from "@/features/help/video/help-canvas";
import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

const mark = { x: 100, y: 100, width: 200, height: 40 };

const video: HelpVideoMedia = {
  parts: [
    { start: 0, travel: 0.9, hold: 1.7, click: 0.6, number: 1, mark },
    { start: 3.2, travel: 0.9, hold: 1.7, click: 0, number: 2, mark },
  ],
  duration: 7.2,
  fade: 0.3,
  stills: ["/first.png", "/second.png"],
  accent: "rgb(0, 128, 128)",
  seconds: 7,
};

// jsdom decodes no image and draws on no canvas: the stills resolve when the test says so.
function decodes(answer: "now" | "never") {
  const decode = () =>
    answer === "now" ? Promise.resolve() : new Promise<void>(() => undefined);

  Object.defineProperty(HTMLImageElement.prototype, "decode", {
    configurable: true,
    value: decode,
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
}

function prefersReducedMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (media: string) => ({
    matches: reduce && media.includes("reduced-motion"),
    media,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

function draw() {
  return renderWithProviders(
    <HelpCanvas video={video} label="Video: a task" />,
    {
      fetch: fakeApi({}),
    },
  );
}

beforeEach(() => {
  localStorage.clear();
  prefersReducedMotion(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the canvas of the help video", () => {
  it("shows the first still as the poster until the stills are decoded", () => {
    decodes("never");
    draw();

    const poster = document.querySelector("img");
    expect(poster?.getAttribute("src")).toBe("/first.png");
    expect(screen.getByRole("img", { name: "Video: a task" }).tagName).toBe(
      "CANVAS",
    );
    expect(
      screen.getByRole("button", { name: catalogEn["help.video.play"] }),
    ).toBeInTheDocument();
  });

  it("plays once the stills are decoded, and space pauses it", async () => {
    decodes("now");
    draw();

    const pause = await screen.findByRole("button", {
      name: catalogEn["help.video.pause"],
    });
    expect(document.querySelector("img")).toBeNull();

    fireEvent.keyDown(screen.getByRole("img", { name: "Video: a task" }), {
      key: " ",
    });

    expect(pause).toHaveAccessibleName(catalogEn["help.video.play"]);
  });

  it("goes to the start of the next and the previous step with the arrows", async () => {
    decodes("never");
    draw();

    const picture = screen.getByRole("img", { name: "Video: a task" });
    const position = screen.getByRole("slider", {
      name: catalogEn["help.video.position"],
    });

    fireEvent.keyDown(picture, { key: "ArrowRight" });
    await waitFor(() => {
      expect(position).toHaveValue("3.2");
    });

    fireEvent.keyDown(picture, { key: "ArrowLeft" });
    await waitFor(() => {
      expect(position).toHaveValue("0");
    });
  });

  it("does not play alone under reduced motion", async () => {
    prefersReducedMotion(true);
    decodes("now");
    draw();

    await waitFor(() => {
      expect(document.querySelector("img")).toBeNull();
    });
    expect(
      screen.getByRole("button", { name: catalogEn["help.video.play"] }),
    ).toBeInTheDocument();
  });
});
