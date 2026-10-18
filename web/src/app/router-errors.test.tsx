import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import { writeLocale } from "@/i18n/locale";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

beforeEach(() => {
  localStorage.clear();
  writeLocale("pt-BR");
});

const me = { id: 1, email: "a@b.c", role: "admin" };

describe("router error screens", () => {
  it("shows a translated error with retry when GET /me fails, and requests /me again", async () => {
    let meCalls = 0;
    let recovered = false;
    const fetch = fakeApi({
      "GET /api/v1/me": () => {
        meCalls += 1;
        return recovered ? json(200, me) : problem(503, "unavailable");
      },
      "GET /api/v1/settings": () => json(200, { base_currency: "BRL" }),
      "GET /api/v1/instruments": () => json(200, { items: [] }),
      "GET /api/v1/accounts": () => json(200, { items: [] }),
      "GET /api/v1/balances": () => json(200, { items: [] }),
    });
    await renderApp("/", { fetch });

    expect(
      await screen.findByText(catalogPtBR["common.error.title"]),
    ).toBeInTheDocument();
    const callsBeforeRetry = meCalls;
    recovered = true;

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: catalogPtBR["common.retry"] }));

    expect(
      await screen.findByRole("heading", { name: catalogPtBR["nav.overview"] }),
    ).toBeInTheDocument();
    expect(meCalls).toBe(callsBeforeRetry + 1);
  });

  it("shows a translated not-found screen for an unknown path", async () => {
    const fetch = fakeApi({
      "GET /api/v1/me": () => json(200, me),
    });
    await renderApp("/does-not-exist", { fetch });

    expect(
      await screen.findByText(catalogPtBR["common.notFound.title"]),
    ).toBeInTheDocument();
  });
});
