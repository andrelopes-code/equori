import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

// Moved from settings-page.test.tsx with their assertions (spec A9): each control now sits in a
// tab of the studio.
describe("appearance studio controls", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("applies the chosen colour scheme and remembers it", async () => {
    await openStudio();
    const group = await screen.findByRole("radiogroup", {
      name: catalogPtBR["more.scheme"],
    });
    expect(
      within(group).getByRole("radio", { name: catalogPtBR["scheme.dark"] }),
    ).toBeChecked();
    await userEvent.click(
      within(group).getByRole("radio", { name: catalogPtBR["scheme.light"] }),
    );
    expect(document.documentElement).toHaveAttribute(
      "data-slotted-scheme",
      "light",
    );
    expect(localStorage.getItem("equori.scheme")).toBe("light");
    expect(
      within(group).getByRole("radio", { name: catalogPtBR["scheme.light"] }),
    ).toBeChecked();
  });

  it("applies the chosen density and remembers it", async () => {
    await openStudio("shape");
    const group = await screen.findByRole("radiogroup", {
      name: catalogPtBR["more.density"],
    });
    await userEvent.click(
      within(group).getByRole("radio", {
        name: catalogPtBR["density.compact"],
      }),
    );
    expect(document.documentElement).toHaveAttribute(
      "data-slotted-density",
      "compact",
    );
    expect(localStorage.getItem("equori.density")).toBe("compact");
  });

  it("applies the chosen accent colour and remembers it", async () => {
    await openStudio("colour");
    const group = await screen.findByRole("radiogroup", {
      name: catalogPtBR["settings.accent"],
    });
    expect(
      within(group).getByRole("radio", {
        name: catalogPtBR["accent.indigo"],
      }),
    ).toBeChecked();
    await userEvent.click(
      within(group).getByRole("radio", {
        name: catalogPtBR["accent.emerald"],
      }),
    );
    expect(
      document.documentElement.style.getPropertyValue("--slotted-seed-accent"),
    ).toBe("#10b981");
    expect(localStorage.getItem("equori.accent")).toBe("emerald");
  });

  it("applies the chosen corners and remembers them", async () => {
    await openStudio("shape");
    const group = await screen.findByRole("radiogroup", {
      name: catalogPtBR["settings.corners"],
    });
    await userEvent.click(
      within(group).getByRole("radio", {
        name: catalogPtBR["corners.round"],
      }),
    );
    expect(document.documentElement.getAttribute("data-slotted-corners")).toBe(
      "round",
    );
    expect(localStorage.getItem("equori.corners")).toBe("round");
  });

  it("applies the high contrast scheme and remembers it", async () => {
    await openStudio();
    const group = await screen.findByRole("radiogroup", {
      name: catalogPtBR["more.scheme"],
    });
    await userEvent.click(
      within(group).getByRole("radio", {
        name: catalogPtBR["scheme.high-contrast"],
      }),
    );
    expect(document.documentElement).toHaveAttribute(
      "data-slotted-scheme",
      "high-contrast",
    );
    expect(localStorage.getItem("equori.scheme")).toBe("high-contrast");
  });

  it("applies the chosen surface tone and remembers it", async () => {
    await openStudio("colour");
    const group = await screen.findByRole("radiogroup", {
      name: catalogPtBR["settings.tone"],
    });
    await userEvent.click(
      within(group).getByRole("radio", { name: catalogPtBR["tone.stone"] }),
    );
    expect(
      document.documentElement.style.getPropertyValue("--slotted-seed-neutral"),
    ).toBe("#78716c");
    expect(localStorage.getItem("equori.tone")).toBe("stone");
  });

  it("applies the chosen text size and remembers it", async () => {
    await openStudio("text");
    const slider = await screen.findByRole("slider", {
      name: catalogPtBR["settings.textSize"],
    });
    slider.focus();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}");
    await waitFor(() => {
      expect(document.documentElement.style.fontSize).toBe("115%");
    });
    expect(localStorage.getItem("equori.textSize")).toBe("115");
  });

  it("uses a face installed on the device by its family name", async () => {
    await openStudio("text");
    const field = await screen.findByRole("textbox", {
      name: catalogPtBR["settings.typeface.custom"],
    });
    await userEvent.type(field, "Fira Sans");
    await userEvent.click(
      screen.getByRole("button", {
        name: catalogPtBR["settings.typeface.use"],
      }),
    );
    expect(
      document.documentElement.style.getPropertyValue(
        "--slotted-font-family-sans",
      ),
    ).toBe('"Fira Sans", system-ui, sans-serif');
    expect(localStorage.getItem("equori.typeface")).toBe("custom:Fira Sans");
  });

  it("refuses a family name that could leave its string", async () => {
    await openStudio("text");
    await userEvent.type(
      await screen.findByRole("textbox", {
        name: catalogPtBR["settings.typeface.custom"],
      }),
      'x"; color: red',
    );
    await userEvent.click(
      screen.getByRole("button", {
        name: catalogPtBR["settings.typeface.use"],
      }),
    );
    expect(
      screen.getByText(catalogPtBR["settings.typeface.invalid"]),
    ).toBeVisible();
    expect(localStorage.getItem("equori.typeface")).toBeNull();
  });

  it("applies the chosen typeface and remembers it", async () => {
    await openStudio("text");
    const group = await screen.findByRole("radiogroup", {
      name: catalogPtBR["settings.typeface"],
    });
    await userEvent.click(
      within(group).getByRole("radio", {
        name: catalogPtBR["typeface.system"],
      }),
    );
    expect(
      document.documentElement.style.getPropertyValue(
        "--slotted-font-family-sans",
      ),
    ).toBe("system-ui, sans-serif");
    expect(localStorage.getItem("equori.typeface")).toBe("system");
  });

  it("shortens every transition when motion is reduced", async () => {
    await openStudio("effects");
    await userEvent.click(
      await screen.findByRole("switch", {
        name: catalogPtBR["settings.motion"],
      }),
    );
    expect(
      document.documentElement.style.getPropertyValue(
        "--slotted-duration-medium",
      ),
    ).toBe("1ms");
    expect(localStorage.getItem("equori.motion")).toBe("reduced");
  });

  it("restores every choice to the default", async () => {
    await openStudio("colour");
    const tones = await screen.findByRole("radiogroup", {
      name: catalogPtBR["settings.tone"],
    });
    await userEvent.click(
      within(tones).getByRole("radio", { name: catalogPtBR["tone.sage"] }),
    );
    await openTab("text");
    (
      await screen.findByRole("slider", {
        name: catalogPtBR["settings.textSize"],
      })
    ).focus();
    await userEvent.keyboard("{ArrowRight}");
    await waitFor(() => {
      expect(document.documentElement.style.fontSize).toBe("105%");
    });
    await userEvent.click(
      screen.getByRole("button", {
        name: catalogPtBR["settings.appearance.reset"],
      }),
    );
    await openTab("colour");
    expect(
      within(
        await screen.findByRole("radiogroup", {
          name: catalogPtBR["settings.tone"],
        }),
      ).getByRole("radio", {
        name: catalogPtBR["tone.graphite"],
      }),
    ).toBeChecked();
    expect(
      document.documentElement.style.getPropertyValue("--slotted-seed-neutral"),
    ).toBe("");
    expect(document.documentElement.style.fontSize).toBe("");
    expect(localStorage.getItem("equori.textSize")).toBe("100");
  });
});

async function openStudio(tab?: StudioTab) {
  await renderApp("/settings/appearance", { fetch: api() });
  if (tab !== undefined) await openTab(tab);
}

type StudioTab = "colour" | "shape" | "text" | "effects";

async function openTab(tab: StudioTab) {
  await userEvent.click(
    await screen.findByRole("tab", { name: catalogPtBR[`studio.tab.${tab}`] }),
  );
}

function api() {
  return fakeApi({
    "GET /api/v1/me": () =>
      json(200, {
        id: 1,
        email: "a@b.c",
        role: "admin",
        language: "pt",
        region: "BR",
      }),
    "GET /api/v1/settings": () => json(200, { base_currency: "BRL" }),
    "GET /api/v1/instruments": () =>
      json(200, { items: [{ code: "BRL", scale: 2 }] }),
  });
}
