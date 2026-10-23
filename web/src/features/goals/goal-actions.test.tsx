import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { accountRoutes, money, reserveID } from "@/testing/account-api";
import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

const goalID = "d1000000-0000-4000-8000-000000000001";
const emergency = {
  id: goalID,
  name: "Emergency fund",
  target: money(3000000),
  due_on: "2027-06-30",
  account_ids: [reserveID],
  current: money(1008341),
  remaining: money(1991659),
  progress_bp: 3361,
};

function api(sent: { method: string; body: unknown }[]) {
  return fakeApi(
    accountRoutes({
      "GET /api/v1/goals": () => json(200, { items: [emergency] }),
      [`PATCH /api/v1/goals/${goalID}`]: async (req) => {
        sent.push({ method: "PATCH", body: await req.json() });
        return json(200, emergency);
      },
      [`DELETE /api/v1/goals/${goalID}`]: () => {
        sent.push({ method: "DELETE", body: null });
        return new Response(null, { status: 204 });
      },
    }),
  );
}

async function openMenu(item: string) {
  const card = await screen.findByRole("article", { name: "Emergency fund" });
  await userEvent.click(
    within(card).getByRole("button", { name: catalogEn["goals.more"] }),
  );
  await userEvent.click(await screen.findByRole("menuitem", { name: item }));
}

describe("goal actions", () => {
  it("edits a goal from its menu with its current values filled in", async () => {
    const sent: { method: string; body: unknown }[] = [];
    await renderApp("/goals", { fetch: api(sent) });
    await openMenu(catalogEn["goals.edit"]);
    const dialog = await screen.findByRole("dialog", {
      name: catalogEn["goals.editTitle"],
    });
    const name = within(dialog).getByRole("textbox", {
      name: catalogEn["goals.name"],
    });
    expect(name).toHaveValue("Emergency fund");
    // The chosen account reads by its name before the list is opened, never by its id.
    expect(
      within(dialog).getByText("Reserva de emergência"),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText(reserveID)).toBeNull();
    expect(
      await within(dialog).findByRole("textbox", {
        name: catalogEn["goals.target"],
      }),
    ).toHaveValue("30,000.00");
    await userEvent.clear(name);
    await userEvent.type(name, "Reserve");
    await userEvent.click(
      within(dialog).getByRole("button", { name: catalogEn["goals.save"] }),
    );
    await waitFor(() => {
      expect(sent).toEqual([
        {
          method: "PATCH",
          body: {
            name: "Reserve",
            target: money(3000000),
            due_on: "2027-06-30",
            account_ids: [reserveID],
          },
        },
      ]);
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("deletes a goal after the reader confirms its name", async () => {
    const sent: { method: string; body: unknown }[] = [];
    await renderApp("/goals", { fetch: api(sent) });
    await openMenu(catalogEn["goals.delete"]);
    const dialog = await screen.findByRole("dialog", {
      name: "Delete Emergency fund?",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: catalogEn["goals.delete"] }),
    );
    await waitFor(() => {
      expect(sent).toEqual([{ method: "DELETE", body: null }]);
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("keeps the goal when the deletion is cancelled", async () => {
    const sent: { method: string; body: unknown }[] = [];
    await renderApp("/goals", { fetch: api(sent) });
    await openMenu(catalogEn["goals.delete"]);
    const dialog = await screen.findByRole("dialog", {
      name: "Delete Emergency fund?",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: catalogEn["detail.cancel"] }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(sent).toEqual([]);
  });
});
