import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { fakeApi } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";
import { ConfirmDialog } from "@/ui/confirm-dialog";

function renderDialog(
  props: Partial<React.ComponentProps<typeof ConfirmDialog>> = {},
) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();

  renderWithProviders(
    <ConfirmDialog
      title="Delete Nubank"
      description="The connection leaves; what it imported stays."
      confirmLabel="Delete connection"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    />,
    { fetch: fakeApi({}) },
  );

  return { onConfirm, onCancel };
}

describe("ConfirmDialog", () => {
  it("announces the description and answers the action without closing", async () => {
    const { onConfirm, onCancel } = renderDialog();

    const dialog = await screen.findByRole("alertdialog", {
      name: "Delete Nubank",
    });
    expect(dialog).toHaveAccessibleDescription(
      "The connection leaves; what it imported stays.",
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Delete connection" }),
    );

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toBeVisible();
  });

  it("answers the cancel and Escape with onCancel", async () => {
    const { onCancel } = renderDialog();

    await userEvent.click(
      await screen.findByRole("button", { name: "Cancel" }),
    );
    await userEvent.keyboard("{Escape}");

    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it("shows the error of a failed action above the buttons", async () => {
    renderDialog({ error: "The connection is in use." });

    expect(await screen.findByText("The connection is in use.")).toBeVisible();
  });

  it("disables the action while the dialog is not ready", async () => {
    renderDialog({ confirmDisabled: true });

    expect(
      await screen.findByRole("button", { name: "Delete connection" }),
    ).toBeDisabled();
  });
});
