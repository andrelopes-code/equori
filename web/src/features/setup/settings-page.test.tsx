import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

interface Sent {
  route: string;
  body: unknown;
}

function api(sent: Sent[], put: () => Response) {
  const record =
    (route: string, answer: (body: unknown) => Response) =>
    async (req: Request) => {
      const body: unknown = await req.json();
      sent.push({ route, body });
      return answer(body);
    };
  return fakeApi({
    "GET /api/v1/me": () =>
      json(200, {
        id: 1,
        email: "a@b.c",
        role: "admin",
        language: "pt",
        region: "BR",
      }),
    "PATCH /api/v1/me": record("PATCH /me", (body) =>
      json(200, {
        id: 1,
        email: "a@b.c",
        role: "admin",
        language: "pt",
        ...(body as object),
      }),
    ),
    "GET /api/v1/settings": () => json(200, { base_currency: "BRL" }),
    "PUT /api/v1/settings": record("PUT /settings", put),
    "GET /api/v1/instruments": () =>
      json(200, {
        items: [
          { code: "BRL", type: "currency", scale: 2, name: "Real" },
          { code: "EUR", type: "currency", scale: 2, name: "Euro" },
        ],
      }),
  });
}

describe("settings page", () => {
  it("names the regions in the active locale and sends the chosen one", async () => {
    const sent: Sent[] = [];
    await renderApp("/settings", {
      fetch: api(sent, () => json(200, { base_currency: "EUR" })),
    });
    await userEvent.click(
      await screen.findByRole("combobox", { name: "Região" }),
    );
    await userEvent.click(
      await screen.findByRole("option", { name: "Estados Unidos" }),
    );
    await userEvent.click(
      await screen.findByRole("combobox", { name: "Região" }),
    );
    await userEvent.click(
      await screen.findByRole("option", { name: "Portugal" }),
    );
    await waitFor(() => {
      expect(sent).toContainEqual({
        route: "PATCH /me",
        body: { region: "PT" },
      });
    });
    expect(document.documentElement.lang).toBe("pt-PT");
  });

  it("sends the base currency", async () => {
    const sent: Sent[] = [];
    await renderApp("/settings", {
      fetch: api(sent, () => json(200, { base_currency: "EUR" })),
    });
    await userEvent.click(
      await screen.findByRole("combobox", { name: "Moeda base" }),
    );
    await userEvent.click(await screen.findByRole("option", { name: /^EUR/ }));
    await waitFor(() => {
      expect(sent).toContainEqual({
        route: "PUT /settings",
        body: { base_currency: "EUR" },
      });
    });
  });

  it("shows the catalog message when transactions lock the currency", async () => {
    const sent: Sent[] = [];
    await renderApp("/settings", {
      fetch: api(sent, () => problem(409, "settings_locked")),
    });
    await userEvent.click(
      await screen.findByRole("combobox", { name: "Moeda base" }),
    );
    await userEvent.click(await screen.findByRole("option", { name: /^EUR/ }));
    expect(
      await screen.findByText(/não podem ser alteradas|cannot be changed/),
    ).toBeVisible();
    expect(catalogEn["problem.settings_locked"]).toContain("cannot be changed");
  });
});
