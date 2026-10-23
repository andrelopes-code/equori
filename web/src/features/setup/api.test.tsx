import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useQuery } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { useApi } from "@/api/api-context";
import { meQuery } from "@/features/session";
import { useChooseRegion } from "@/features/setup";
import { fakeApi, json } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

function Probe() {
  const { data } = useQuery({ ...meQuery(useApi()), staleTime: Infinity });
  const choose = useChooseRegion();
  return (
    <>
      <output>{data?.region ?? "none"}</output>
      <button
        onClick={() => {
          choose("PT");
        }}
      >
        choose
      </button>
    </>
  );
}

describe("useChooseRegion", () => {
  it("writes the stored profile into the /me cache", async () => {
    renderWithProviders(<Probe />, {
      fetch: fakeApi({
        "GET /api/v1/me": () =>
          json(200, { id: "u1", email: "a@b.c", language: "pt", region: "BR" }),
        "PATCH /api/v1/me": () =>
          json(200, { id: "u1", email: "a@b.c", language: "pt", region: "PT" }),
      }),
    });
    expect(await screen.findByText("BR")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "choose" }));
    expect(await screen.findByText("PT")).toBeInTheDocument();
  });
});
