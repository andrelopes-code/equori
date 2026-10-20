import { beforeEach, describe, expect, it } from "vitest";

import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

const html = document.documentElement;

function newFetch() {
  return fakeApi({
    "GET /api/v1/me": () =>
      json(200, { id: "user-1", email: "owner@example.com" }),
  });
}

beforeEach(() => {
  localStorage.clear();
  html.removeAttribute("lang");
});

describe("AppProviders locale", () => {
  it("sets html lang from the stored locale on first load", async () => {
    localStorage.setItem("equori.locale", "pt-BR");
    await renderApp("/", { width: 360, fetch: newFetch() });
    expect(html).toHaveAttribute("lang", "pt-BR");
  });

  it("sets html lang to en when no locale is stored", async () => {
    await renderApp("/", { width: 360, fetch: newFetch() });
    expect(html).toHaveAttribute("lang", "en");
  });
});
