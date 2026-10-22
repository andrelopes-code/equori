import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { fakeApi, json } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";
import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import { I18nProvider, useAppLocaleState, useT } from "@/i18n/i18n-provider";
import { readLocale, tagOf, writeLocale } from "@/i18n/locale";
import { TodayProvider, useToday } from "@/i18n/today";

function Probe() {
  const t = useT();
  return (
    <>
      <p data-testid="home">{t("nav.home")}</p>
      <p data-testid="count">{t("common.selected", { count: 3 })}</p>
    </>
  );
}

function Day() {
  return <p data-testid="day">{useToday()}</p>;
}

describe("I18nProvider", () => {
  it("renders pt-BR text and replaces placeholders", () => {
    render(
      <I18nProvider locale={{ language: "pt", region: "BR" }}>
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByTestId("home")).toHaveTextContent(
      catalogPtBR["nav.home"],
    );
    expect(screen.getByTestId("count")).toHaveTextContent("3 selecionados");
  });

  it("renders English text", () => {
    render(
      <I18nProvider locale={{ language: "en", region: "US" }}>
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByTestId("count")).toHaveTextContent("3 selected");
  });
});

describe("TodayProvider", () => {
  it("returns the provided date", () => {
    render(
      <TodayProvider today="2026-10-17">
        <Day />
      </TodayProvider>,
    );
    expect(screen.getByTestId("day")).toHaveTextContent("2026-10-17");
  });
});

describe("locale", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("lang");
  });

  it("formats the tag from language and region", () => {
    expect(tagOf({ language: "pt", region: "BR" })).toBe("pt-BR");
  });

  it("reads the stored pair before the browser language", () => {
    localStorage.setItem(
      "equori.locale",
      JSON.stringify({ language: "pt", region: "PT" }),
    );
    expect(readLocale()).toEqual({ language: "pt", region: "PT" });
  });

  it("ignores a stored value that is not a pair", () => {
    localStorage.setItem("equori.locale", "pt-BR");
    expect(readLocale()).toEqual({ language: "en", region: "US" });
  });

  it("falls back to the browser language and region", () => {
    expect(readLocale()).toEqual({ language: "en", region: "US" });
  });

  it("stores the pair and sets the html lang to the tag", () => {
    writeLocale({ language: "pt", region: "BR" });
    expect(localStorage.getItem("equori.locale")).toBe(
      JSON.stringify({ language: "pt", region: "BR" }),
    );
    expect(document.documentElement.lang).toBe("pt-BR");
  });
});

function Tag() {
  const { tag, language } = useAppLocaleState();
  return (
    <p data-testid="tag">
      {tag}|{language}
    </p>
  );
}

describe("profile locale", () => {
  it("replaces the stored pair with the language and region of GET /me", async () => {
    localStorage.setItem(
      "equori.locale",
      JSON.stringify({ language: "pt", region: "BR" }),
    );
    const fetch = fakeApi({
      "GET /api/v1/me": () =>
        json(200, { id: 1, email: "a@b.c", language: "en", region: "DE" }),
    });
    renderWithProviders(<Tag />, { fetch });
    expect(await screen.findByText("en-DE|en")).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("en-DE");
    expect(localStorage.getItem("equori.locale")).toBe(
      JSON.stringify({ language: "en", region: "DE" }),
    );
  });
});
