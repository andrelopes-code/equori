import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";
import { DateInput } from "@/ui/form-fields/date-input";

describe("DateInput", () => {
  it.each([
    { label: catalogEn["day.yesterday"], iso: "2026-10-16" },
    { label: catalogEn["day.beforeYesterday"], iso: "2026-10-15" },
  ])("writes the day of the shortcut $label and closes", async (shortcut) => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    open(onChange, true);

    await user.click(await trigger());
    await user.click(
      await screen.findByRole("button", {
        name: new RegExp(`^${shortcut.label}`),
      }),
    );

    expect(onChange.mock.calls).toEqual([[shortcut.iso]]);
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("offers no shortcut where the field takes none", async () => {
    const user = userEvent.setup();
    open(vi.fn(), false);

    await user.click(await trigger());
    await screen.findByRole("dialog");

    expect(
      screen.queryByRole("button", {
        name: new RegExp(`^${catalogEn["day.yesterday"]}`),
      }),
    ).toBeNull();
  });

  it("draws no Clear in the panel of a date that cannot be cleared", async () => {
    const user = userEvent.setup();
    open(vi.fn(), true);

    await user.click(await trigger());
    const panel = await screen.findByRole("dialog");

    expect(panel.querySelector('[data-part="clear"]')).toBeNull();
  });
});

function open(onChange: (iso: string) => void, shortcuts: boolean) {
  renderWithProviders(
    <DateInput
      name="date"
      value="2026-10-10"
      onChange={onChange}
      shortcuts={shortcuts}
    />,
    { fetch: fakeApi({}) },
  );
}

function trigger() {
  return screen.findByRole("button", { name: /^(choose|change) date/i });
}
