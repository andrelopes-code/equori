import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

import {
  enqueueCapture,
  findQueued,
} from "@/features/transactions/capture-queue";
import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";
import {
  checkingID,
  foodID,
  payeeID,
  sharedRoutes,
  transactionFixture,
} from "@/testing/transaction-api";

const groceries = {
  line: 1,
  text: "mercado 230 itau",
  segments: [
    { text: "mercado ", role: "text" },
    { text: "230", role: "amount" },
    { text: " ", role: "text" },
    { text: "itau", role: "account" },
  ],
  kind: "expense",
  amount: { amount: 23000, currency: "BRL" },
  date: "2026-10-15",
  account_id: checkingID,
  account_source: "text",
  description: "Mercado",
  category_id: foodID,
  category_source: "rule",
  payee_id: payeeID,
  tags: [],
  issues: [],
};

const batchRoute = vi.fn(() => json(201, { items: [transactionFixture()] }));

function routes(preview: (req: Request) => Promise<Response> | Response) {
  return fakeApi({
    ...sharedRoutes,
    "POST /api/v1/capture/preview": preview,
    "POST /api/v1/capture/suggestions": () =>
      json(200, { available: true, items: [] }),
    "POST /api/v1/transaction-batches": batchRoute,
  });
}

beforeEach(() => {
  localStorage.clear();
  batchRoute.mockClear();
});

it("lists only the signed-in user's entries", async () => {
  enqueueCapture({
    userId: 1,
    text: "mercado 230 itau",
    defaultAccountId: null,
    capturedOn: "2026-10-15",
  });
  enqueueCapture({
    userId: 2,
    text: "someone else",
    defaultAccountId: null,
    capturedOn: "2026-10-15",
  });
  await renderApp("/transactions/queue", {
    fetch: routes(() => json(200, { lines: [] })),
  });
  expect(await screen.findByText("mercado 230 itau")).toBeInTheDocument();
  expect(screen.queryByText("someone else")).toBeNull();
});

it("previews a queued text against the day it was written and removes it once recorded", async () => {
  const queued = enqueueCapture({
    userId: 1,
    text: "mercado 230 itau",
    defaultAccountId: null,
    capturedOn: "2026-10-15",
  });
  const bodies: unknown[] = [];
  const { router } = await renderApp("/transactions/queue", {
    fetch: routes(async (req) => {
      bodies.push(await req.json());
      return json(200, { lines: [groceries] });
    }),
  });
  await userEvent.click(
    await screen.findByRole("button", { name: catalogEn["queue.process"] }),
  );
  await waitFor(() => {
    expect(bodies).toContainEqual(
      expect.objectContaining({
        text: "mercado 230 itau",
        reference_date: "2026-10-15",
      }),
    );
  });
  await userEvent.click(
    await screen.findByRole("button", { name: /Record 1/ }),
  );
  await waitFor(() => {
    expect(router.state.location.pathname).toBe("/transactions/queue");
  });
  expect(findQueued(queued.id)).toBeUndefined();
});

it("keeps the entry when recording fails", async () => {
  batchRoute.mockImplementationOnce(() => problem(500, "internal"));
  const queued = enqueueCapture({
    userId: 1,
    text: "mercado 230 itau",
    defaultAccountId: null,
    capturedOn: "2026-10-15",
  });
  await renderApp(`/transactions/capture?queued=${queued.id}`, {
    fetch: routes(() => json(200, { lines: [groceries] })),
  });
  await userEvent.click(
    await screen.findByRole("button", { name: /Record 1/ }),
  );
  await waitFor(() => {
    expect(batchRoute).toHaveBeenCalled();
  });
  expect(findQueued(queued.id)).toBeDefined();
});

it("announces waiting entries in the shell", async () => {
  enqueueCapture({
    userId: 1,
    text: "uber 12",
    defaultAccountId: null,
    capturedOn: "2026-10-15",
  });
  enqueueCapture({
    userId: 1,
    text: "padaria 8",
    defaultAccountId: null,
    capturedOn: "2026-10-16",
  });
  await renderApp("/transactions/capture", {
    fetch: routes(() => json(200, { lines: [] })),
  });
  // The toast's title; the copy in the announcing region is shared across the tests of a file.
  expect(
    await screen.findByText("2 offline captures waiting", {
      selector: '[data-part="title"]',
    }),
  ).toBeInTheDocument();
});
