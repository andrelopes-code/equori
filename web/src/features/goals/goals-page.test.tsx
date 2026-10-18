import { fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import { writeLocale } from "@/i18n/locale";
import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

beforeEach(() => {
  localStorage.clear();
  writeLocale("pt-BR");
});

function goal(
  id: string,
  name: string,
  current: number,
  target: number,
  due: string,
) {
  return {
    id,
    name,
    target: { amount: target, currency: "BRL" },
    due_on: due,
    account_ids: ["a-1"],
    current: { amount: current, currency: "BRL" },
    remaining: { amount: Math.max(target - current, 0), currency: "BRL" },
    progress_bp: Math.floor((current / target) * 10000),
  };
}

function goalsApi(items: unknown[]) {
  return fakeApi({
    "GET /api/v1/me": () => json(200, { id: 1, email: "a@b.c", role: "admin" }),
    "GET /api/v1/settings": () => json(200, { base_currency: "BRL" }),
    "GET /api/v1/instruments": () =>
      json(200, {
        items: [{ code: "BRL", type: "currency", scale: 2, name: "Real" }],
      }),
    "GET /api/v1/goals": () => json(200, { items }),
  });
}

const text = (node: Element | null | undefined) =>
  node?.textContent.replace(/\u00a0/g, " ");

// Complete frontend decisions R5-1 and R5-2.
describe("goals page", () => {
  it("lists each goal with saved, target, the monthly plan and when it is ready", async () => {
    await renderApp("/goals", {
      fetch: goalsApi([
        goal("g-1", "Viagem ao Japão", 500000, 2500000, "2027-06-30"),
        goal("g-2", "Reserva", 3200000, 5000000, "2027-12-31"),
      ]),
    });
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: catalogPtBR["goals.title"],
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("R$ 37.000,00 guardados em 2 metas"),
    ).toBeInTheDocument();
    const table = screen.getByRole("table", {
      name: catalogPtBR["goals.title"],
    });
    const row = within(table).getByText("Viagem ao Japão").closest("tr");
    expect(text(row)).toContain("5.000,00");
    expect(text(row)).toContain("25.000,00");
    expect(text(row)).toContain("2.500,00");
    expect(text(row)).toContain("jun. de 2027");
    expect(text(table.querySelector("tfoot"))).toContain("37.000,00");
  });

  it("recomputes the month a goal is ready while the monthly amount moves, and warns past the due date", async () => {
    await renderApp("/goals", {
      fetch: goalsApi([
        goal("g-1", "Viagem ao Japão", 500000, 2500000, "2027-06-30"),
      ]),
    });
    const slider = await screen.findByRole("slider", {
      name: catalogPtBR["goals.monthly.for"].replace(
        "{goal}",
        "Viagem ao Japão",
      ),
    });
    fireEvent.keyDown(slider, { key: "Home" });
    const row = screen.getByText("Viagem ao Japão").closest("tr");
    expect(text(row)).toContain("50,00");
    const ready = row?.querySelector("[data-late]");
    expect(ready).toHaveAttribute("data-late", "true");
    // R$ 20.000,00 left at R$ 50,00 a month: 400 months after October 2026.
    expect(text(ready)).toBe("fev. de 2060");
  });
});
