import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useQuery } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { useApi } from "@/api/api-context";
import { meQuery, useChooseLanguage } from "@/features/session";
import { fakeApi, json } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

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
