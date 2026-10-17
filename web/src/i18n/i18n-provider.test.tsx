import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import { I18nProvider, useT } from "@/i18n/i18n-provider";
import { detectLocale, readLocale, writeLocale } from "@/i18n/locale";
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
      <I18nProvider locale="pt-BR">
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
      <I18nProvider locale="en">
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

  it("detects the locale from a language tag", () => {
    expect(detectLocale("pt-PT")).toBe("pt-BR");
    expect(detectLocale("pt")).toBe("pt-BR");
    expect(detectLocale("fr")).toBe("en");
  });

  it("reads the stored locale before the browser language", () => {
    localStorage.setItem("equori.locale", "en");
    expect(readLocale()).toBe("en");
  });

  it("falls back to the browser language", () => {
    expect(readLocale()).toBe("en");
  });

  it("stores the locale and sets the html lang", () => {
    writeLocale("pt-BR");
    expect(localStorage.getItem("equori.locale")).toBe("pt-BR");
    expect(document.documentElement.lang).toBe("pt-BR");
  });
});
