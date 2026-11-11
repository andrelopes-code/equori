import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useQuery } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { useApi } from "@/api/api-context";
import { meQuery, useChooseLanguage, useSwitchBooks } from "@/features/session";
import { reloadHome } from "@/features/session/model/reload-home";
import { fakeApi, json } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

vi.mock("@/features/session/model/reload-home", () => ({
  reloadHome: vi.fn(),
}));

function Probe() {
  const { data } = useQuery({ ...meQuery(useApi()), staleTime: Infinity });
  const choose = useChooseLanguage();
  return (
    <>
      <output>{data?.language ?? "none"}</output>
      <button
        onClick={() => {
          choose("en");
        }}
      >
        choose
      </button>
    </>
  );
}

describe("useChooseLanguage", () => {
  it("writes the stored profile into the /me cache", async () => {
    renderWithProviders(<Probe />, {
      fetch: fakeApi({
        "GET /api/v1/me": () =>
          json(200, { id: "u1", email: "a@b.c", language: "pt", region: "BR" }),
        "PATCH /api/v1/me": () =>
          json(200, { id: "u1", email: "a@b.c", language: "en", region: "BR" }),
      }),
    });
    expect(await screen.findByText("pt")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "choose" }));
    expect(await screen.findByText("en")).toBeInTheDocument();
  });
});

describe("useSwitchBooks", () => {
  it("stores the active book before it reloads the home", async () => {
    localStorage.clear();
    let stored: string | null = "unset";
    vi.mocked(reloadHome).mockImplementation(() => {
      stored = localStorage.getItem("equori.activeBooks");
    });
    function Switch() {
      const { mutate } = useSwitchBooks();
      return (
        <button
          onClick={() => {
            mutate(9);
          }}
        >
          switch
        </button>
      );
    }
    renderWithProviders(<Switch />, {
      fetch: fakeApi({
        "PUT /api/v1/session/books": () => new Response(null, { status: 204 }),
      }),
    });

    await userEvent.click(screen.getByRole("button", { name: "switch" }));

    await vi.waitFor(() => {
      expect(reloadHome).toHaveBeenCalledTimes(1);
    });
    expect(stored).toBe("9");
  });
});
