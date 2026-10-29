import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi, json } from "@/testing/fake-api";
import { hideAmounts } from "@/testing/privacy";
import { renderApp } from "@/testing/render-app";
import {
  sharedRoutes,
  transactionFixture,
  txID,
} from "@/testing/transaction-api";

const ids = {
  one: "d0000000-0000-4000-8000-000000000001",
  two: "d0000000-0000-4000-8000-000000000002",
  pdf: "d0000000-0000-4000-8000-000000000003",
  three: "d0000000-0000-4000-8000-000000000004",
};

const file = (id: string, name: string, mediaType: string, size: number) => ({
  id,
  transaction_id: txID,
  file_name: name,
  media_type: mediaType,
  size,
  sha256: "0".repeat(64),
  created_at: "2026-10-12T12:00:00Z",
});

const items = [
  file(ids.one, "receipt-1.png", "image/png", 2048),
  file(ids.pdf, "invoice.pdf", "application/pdf", 1_572_864),
  file(ids.two, "receipt-2.jpg", "image/jpeg", 900),
  file(ids.three, "receipt-3.webp", "image/webp", 500),
];

const content = (id: string) => `/api/v1/attachments/${id}/content`;

function api() {
  return fakeApi({
    ...sharedRoutes,
    [`GET /api/v1/transactions/${txID}`]: () => json(200, transactionFixture()),
    [`GET /api/v1/transactions/${txID}/versions`]: () =>
      json(200, { items: [] }),
    [`GET /api/v1/transactions/${txID}/categorization`]: () => json(404, {}),
    [`GET /api/v1/transactions/${txID}/attachments`]: () =>
      json(200, { items }),
  });
}

const path = `/transactions/${txID}`;

async function open(name: string) {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name }));
  return { user, dialog: await screen.findByRole("dialog") };
}

const shown = (dialog: HTMLElement) =>
  within(dialog).getByRole<HTMLImageElement>("img");

beforeAll(() => {
  // jsdom has no PointerEvent: a MouseEvent carries the coordinates the viewer reads.
  class PointerEventShim extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
    }
  }
  Object.defineProperty(window, "PointerEvent", { value: PointerEventShim });
});

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(
    "equori.locale",
    JSON.stringify({ language: "en", region: "US" }),
  );
});

describe("attachments of a transaction", () => {
  it("shows the size and the upload time of each file", async () => {
    await renderApp(path, { fetch: api() });
    await screen.findByRole("button", { name: "receipt-1.png" });
    expect(screen.getByText(/2 kB/)).toBeInTheDocument();
    expect(screen.getByText(/1\.5 MB/)).toBeInTheDocument();
    expect(screen.getByText(/900 byte/)).toBeInTheDocument();
    expect(screen.getAllByText(/Oct 12, 2026/)).toHaveLength(items.length);
  });

  it("formats the size and the date by the tag of another region", async () => {
    localStorage.setItem(
      "equori.locale",
      JSON.stringify({ language: "en", region: "DE" }),
    );
    await renderApp(path, { fetch: api() });
    await screen.findByRole("button", { name: "receipt-1.png" });
    expect(screen.getByText(/1,5 MB/)).toBeInTheDocument();
    expect(screen.getAllByText(/12 Oct 2026/)).toHaveLength(items.length);
  });

  it("keeps the metadata visible in privacy mode", async () => {
    hideAmounts();
    await renderApp(path, { fetch: api() });
    await screen.findByRole("button", { name: "receipt-1.png" });
    expect(screen.getByText(/1\.5 MB/)).toBeInTheDocument();
  });

  it("draws a lazy thumbnail from the content of an image and no image for a PDF", async () => {
    const { container } = await renderApp(path, { fetch: api() });
    await screen.findByRole("button", { name: "receipt-1.png" });
    const thumbnails = [...container.querySelectorAll("img")];
    expect(thumbnails.map((img) => img.getAttribute("src"))).toEqual([
      content(ids.one),
      content(ids.two),
      content(ids.three),
    ]);
    expect(
      thumbnails.every((img) => img.getAttribute("loading") === "lazy"),
    ).toBe(true);
  });

  it("opens a PDF in a frame with the inline disposition and keeps the download", async () => {
    await renderApp(path, { fetch: api() });
    const { dialog } = await open("invoice.pdf");
    const frame = within(dialog).getByTitle("invoice.pdf");
    expect(frame.tagName).toBe("IFRAME");
    expect(frame).toHaveAttribute(
      "src",
      `${content(ids.pdf)}?disposition=inline`,
    );
    expect(within(dialog).queryByRole("img")).toBeNull();
    const download = within(dialog).getByRole("link", {
      name: catalogEn["attachment.download"],
    });
    expect(download).toHaveAttribute("href", content(ids.pdf));
    expect(download).toHaveAttribute("download", "invoice.pdf");
  });

  it("opens the viewer on the image and returns the focus on Escape", async () => {
    await renderApp(path, { fetch: api() });
    const { user, dialog } = await open("receipt-1.png");
    expect(shown(dialog)).toHaveAttribute("src", content(ids.one));
    expect(within(dialog).getByText("receipt-1.png")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("link", {
        name: catalogEn["attachment.download"],
      }),
    ).toHaveAttribute("download", "receipt-1.png");
    await user.keyboard("{Escape}");
    // Presence completes an exit one frame after its node detaches.
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "receipt-1.png" })).toHaveFocus();
  });

  // Slotted issue #48: a press on the picture ends its click on the card itself.
  it("opens the viewer from a click that lands on the card", async () => {
    await renderApp(path, { fetch: api() });
    const trigger = await screen.findByRole("button", {
      name: "receipt-2.jpg",
    });
    const card = trigger.closest('[data-ui="attachment"]');
    if (card === null) throw new Error("no card around the trigger");

    fireEvent.click(card);

    const dialog = await screen.findByRole("dialog");
    expect(shown(dialog)).toHaveAttribute("src", content(ids.two));
  });

  it("zooms by button, by key and by wheel", async () => {
    await renderApp(path, { fetch: api() });
    const { user, dialog } = await open("receipt-1.png");
    expect(within(dialog).getByText("100%")).toBeInTheDocument();
    await user.click(
      within(dialog).getByRole("button", {
        name: catalogEn["attachment.zoomIn"],
      }),
    );
    expect(within(dialog).getByText("125%")).toBeInTheDocument();
    await user.keyboard("+");
    expect(within(dialog).getByText("150%")).toBeInTheDocument();
    await user.keyboard("-");
    expect(within(dialog).getByText("125%")).toBeInTheDocument();
    fireEvent.wheel(shown(dialog), { deltaY: -100 });
    expect(within(dialog).getByText("150%")).toBeInTheDocument();
    await user.click(
      within(dialog).getByRole("button", {
        name: catalogEn["attachment.zoomReset"],
      }),
    );
    expect(within(dialog).getByText("100%")).toBeInTheDocument();
  });

  it("steps between the files, the PDF included, by button and by arrow key", async () => {
    await renderApp(path, { fetch: api() });
    const { user, dialog } = await open("receipt-1.png");
    const previous = within(dialog).getByRole("button", {
      name: catalogEn["attachment.previous"],
    });
    const next = within(dialog).getByRole("button", {
      name: catalogEn["attachment.next"],
    });
    expect(previous).toBeDisabled();
    expect(within(dialog).getByText("1 of 4")).toBeInTheDocument();
    await user.click(next);
    expect(within(dialog).getByTitle("invoice.pdf")).toBeInTheDocument();
    expect(within(dialog).getByText("2 of 4")).toBeInTheDocument();
    await user.keyboard("{ArrowRight}");
    expect(shown(dialog)).toHaveAttribute("src", content(ids.two));
    await user.keyboard("{ArrowRight}");
    expect(shown(dialog)).toHaveAttribute("src", content(ids.three));
    expect(next).toBeDisabled();
    await user.keyboard("{ArrowLeft}");
    expect(shown(dialog)).toHaveAttribute("src", content(ids.two));
    expect(within(dialog).getByText("3 of 4")).toBeInTheDocument();
  });

  it("swipes between the files on a phone", async () => {
    await renderApp(path, { fetch: api(), width: 390 });
    const { dialog } = await open("receipt-1.png");
    const image = shown(dialog);
    fireEvent.pointerDown(image, { clientX: 300, clientY: 200, pointerId: 1 });
    fireEvent.pointerUp(image, { clientX: 100, clientY: 210, pointerId: 1 });
    const frame = within(dialog).getByTitle("invoice.pdf");
    // The frame takes its own touches, so the swipe lands on the stage around it.
    const stage = frame.parentElement;
    if (stage === null) throw new Error("no stage around the frame");
    fireEvent.pointerDown(stage, { clientX: 100, clientY: 200, pointerId: 1 });
    fireEvent.pointerUp(stage, { clientX: 300, clientY: 200, pointerId: 1 });
    expect(shown(dialog)).toHaveAttribute("src", content(ids.one));
  });

  it("does not step on a short or vertical drag", async () => {
    await renderApp(path, { fetch: api(), width: 390 });
    const { dialog } = await open("receipt-1.png");
    const image = shown(dialog);
    fireEvent.pointerDown(image, { clientX: 300, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(image, { clientX: 280, clientY: 110, pointerId: 1 });
    fireEvent.pointerDown(image, { clientX: 300, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(image, { clientX: 100, clientY: 400, pointerId: 1 });
    expect(shown(dialog)).toHaveAttribute("src", content(ids.one));
  });
});
