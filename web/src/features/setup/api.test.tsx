import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { useUpdateBooks } from "@/features/setup/api";
import { useAppLocaleState } from "@/i18n/i18n-provider";
import { fakeApi, json } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

function Probe() {
  const { locale } = useAppLocaleState();
  const update = useUpdateBooks();
  return (
    <>
      <output>{locale.region}</output>
      <button
        onClick={() => {
          update.mutate({ region: "PT", time_zone: "Asia/Tokyo" });
        }}
      >
        choose
      </button>
    </>
  );
}

describe("useUpdateBooks", () => {
  it("applies the region before the answer and sends both fields", async () => {
    const bodies: unknown[] = [];
    let answer: (response: Response) => void = () => undefined;
    renderWithProviders(<Probe />, {
      fetch: fakeApi({
        "GET /api/v1/me": () =>
          json(200, { id: 1, email: "a@b.c", language: "pt", region: "BR" }),
        "PATCH /api/v1/books/current": async (req: Request) => {
          bodies.push(await req.json());
          return new Promise<Response>((resolve) => {
            answer = resolve;
          });
        },
      }),
    });
    expect(await screen.findByText("BR")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "choose" }));
    expect(await screen.findByText("PT")).toBeInTheDocument();
    expect(bodies).toEqual([{ region: "PT", time_zone: "Asia/Tokyo" }]);
    answer(
      json(200, {
        region: "PT",
        time_zone: "Asia/Tokyo",
        default_time_zone: "Europe/Lisbon",
      }),
    );
  });
});
