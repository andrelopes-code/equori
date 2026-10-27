import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { accountRoutes } from "@/testing/account-api";
import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

const holidays2026 = [
  { date: "2026-03-20", name: "Spring Day", source: "rule" },
  { date: "2026-03-25", name: "Local Day", source: "instance" },
  { date: "2026-12-25", name: "Winter Day", source: "rule" },
];

// A neutral region: the default calendar is weekend, and one calendar rests on Friday and Saturday.
function api(region = "DE") {
  const years: string[] = [];
  const fetch = fakeApi(
    accountRoutes({
      "GET /api/v1/me": () =>
        json(200, {
          id: 1,
          email: "a@b.c",
          role: "admin",
          language: "en",
          region,
        }),
      "GET /api/v1/calendars": () =>
        json(200, {
          default: "weekend",
          items: [
            { id: "gulf", weekend: ["friday", "saturday"] },
            { id: "weekend", weekend: ["saturday", "sunday"] },
          ],
        }),
      "GET /api/v1/calendars/weekend/holidays": () => json(200, { items: [] }),
      "GET /api/v1/calendars/gulf/holidays": (req) => {
        const year = new URL(req.url).searchParams.get("year") ?? "";
        years.push(year);
        return json(200, { items: year === "2026" ? holidays2026 : [] });
      },
    }),
  );
  return { fetch, years };
}

function section() {
  return screen.getByRole("region", { name: catalogEn["calendar.title"] });
}

describe("Calendars section", () => {
  it("lists the region's calendar first with its weekend days named by the locale", async () => {
    await renderApp("/settings?section=calendars", { fetch: api().fetch });
    const list = await within(section()).findByRole("list", {
      name: catalogEn["calendar.title"],
    });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent(catalogEn["calendar.weekend"]);
    expect(items[0]).toHaveTextContent(catalogEn["calendar.regionMark"]);
    expect(items[0]).toHaveTextContent("Weekend: Saturday and Sunday");
    expect(items[1]).toHaveTextContent("gulf");
    expect(items[1]).toHaveTextContent("Weekend: Friday and Saturday");
    expect(items[1]).not.toHaveTextContent(catalogEn["calendar.regionMark"]);
    expect(section()).not.toHaveTextContent(/br_banking|Brazil|Brasil|dias/i);
  });

  it("says what a calendar is for and shows the region's calendar until another is chosen", async () => {
    await renderApp("/settings?section=calendars", { fetch: api().fetch });
    expect(
      await within(section()).findByText(catalogEn["calendar.purpose"]),
    ).toBeVisible();
    expect(
      await within(section()).findByText(
        "No holidays in 2026. Only weekends are not business days.",
      ),
    ).toBeVisible();
    const list = within(section()).getByRole("list", {
      name: catalogEn["calendar.title"],
    });
    expect(within(list).getAllByRole("listitem")[0]).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("lists the holidays of the chosen calendar by month with their source", async () => {
    const { fetch, years } = api();
    const { router } = await renderApp("/settings?section=calendars", {
      fetch,
    });
    await userEvent.click(
      await within(section()).findByRole("link", { name: /gulf/ }),
    );
    expect(await screen.findByText("Spring Day")).toBeInTheDocument();
    expect(years).toEqual(["2026"]);
    const march = screen.getByRole("list", { name: "March" });
    expect(within(march).getByText("Local Day")).toBeInTheDocument();
    expect(within(march).getByText("Spring Day")).toBeInTheDocument();
    expect(
      within(march).getAllByText(catalogEn["calendar.source.rule"]),
    ).toHaveLength(1);
    expect(
      within(march).getByText(catalogEn["calendar.source.instance"]),
    ).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "December" })).toBeInTheDocument();
    expect(router.state.location.search).toMatchObject({ calendar: "gulf" });
  });

  it("steps the year and says so when only weekends are not business days", async () => {
    const { fetch, years } = api();
    const { router } = await renderApp(
      "/settings?section=calendars&calendar=gulf",
      { fetch },
    );
    await screen.findByText("Spring Day");
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["calendar.year.next"] }),
    );
    expect(
      await screen.findByText(
        "No holidays in 2027. Only weekends are not business days.",
      ),
    ).toBeInTheDocument();
    expect(years).toEqual(["2026", "2027"]);
    expect(router.state.location.search).toMatchObject({ year: 2027 });
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["calendar.year.previous"] }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["calendar.year.previous"] }),
    );
    await waitFor(() => {
      expect(years).toContain("2025");
    });
  });

  it("reopens the same view from the address", async () => {
    const { fetch, years } = api();
    await renderApp("/settings?section=calendars&calendar=gulf&year=2026", {
      fetch,
    });
    expect(await screen.findByText("Winter Day")).toBeInTheDocument();
    expect(years).toEqual(["2026"]);
  });
});
