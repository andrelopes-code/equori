import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { useSaveAppearance } from "@/features/session";
import { AppearanceSaveError } from "@/features/setup/appearance-save-error";
import { fakeApi, problem } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

describe("AppearanceSaveError", () => {
  it("renders nothing without a failed save", () => {
    renderWithProviders(<AppearanceSaveError />, { fetch: fakeApi({}) });

    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByText(/16 KiB/)).toBeNull();
  });

  it("shows the refusal of a save over the size limit", async () => {
    renderWithProviders(
      <>
        <SaveButton />
        <AppearanceSaveError />
      </>,
      {
        fetch: fakeApi({
          "PUT /api/v1/me/appearance": () =>
            problem(422, "appearance_too_large"),
        }),
      },
    );

    await userEvent.click(screen.getByRole("button", { name: "save" }));

    expect(
      await screen.findByText(
        "The appearance is over 16 KiB. Remove saved themes to store it in the account.",
      ),
    ).toBeVisible();
  });
});

function SaveButton() {
  const save = useSaveAppearance();

  return (
    <button
      type="button"
      onClick={() => {
        save.mutate({});
      }}
    >
      save
    </button>
  );
}
