import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

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

const frame = (dialog: HTMLElement) => dialog.querySelector("iframe");

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
    expect(frame(dialog)).toHaveAttribute(
      "src",
      `${content(ids.pdf)}?disposition=inline`,
    );
    expect(within(dialog).queryByRole("img")).toBeNull();
    const download = within(dialog).getByRole("link", {
      name: "Download",
    });
    expect(download).toHaveAttribute("href", content(ids.pdf));
    expect(download).toHaveAttribute("download", "invoice.pdf");
  });

  it("opens the viewer on the image and returns the focus on Escape", async () => {
    await renderApp(path, { fetch: api() });
    const { user, dialog } = await open("receipt-1.png");
    expect(shown(dialog)).toHaveAttribute("src", content(ids.one));
    expect(
      within(dialog).getByRole("heading", { name: "receipt-1.png" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("link", {
        name: "Download",
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

  it("steps between the files, the PDF included, by button and by arrow key", async () => {
    await renderApp(path, { fetch: api() });
    const { user, dialog } = await open("receipt-1.png");
    const previous = within(dialog).getByRole("button", {
      name: "Previous file",
    });
    const next = within(dialog).getByRole("button", {
      name: "Next file",
    });
    expect(previous).toBeDisabled();
    expect(within(dialog).getByText("1 of 4")).toBeInTheDocument();
    // In a browser the viewer opens with the focus on its stage; jsdom leaves it on the trigger.
    act(() => {
      dialog.querySelector<HTMLElement>('[data-part="stage"]')?.focus();
    });
    await user.keyboard("{ArrowRight}");
    expect(frame(dialog)).toHaveAttribute("title", "invoice.pdf");
    expect(within(dialog).getByText("2 of 4")).toBeInTheDocument();
    await user.keyboard("{ArrowRight}");
    expect(shown(dialog)).toHaveAttribute("src", content(ids.two));
    await user.click(next);
    expect(shown(dialog)).toHaveAttribute("src", content(ids.three));
    expect(next).toBeDisabled();
    await user.click(previous);
    expect(shown(dialog)).toHaveAttribute("src", content(ids.two));
    expect(within(dialog).getByText("3 of 4")).toBeInTheDocument();
  });
});
