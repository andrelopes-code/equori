import { Button } from "@slotted/react/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@slotted/react/dialog";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";
import { DetailDialog } from "@/ui/dialogs/detail-dialog";

describe("DetailDialog", () => {
  it("DL2: the body is absent before the trigger is pressed and present after", async () => {
    renderWithProviders(
      <DetailDialog title="T" description="D" summary="S" triggerLabel="Open">
        <p>Body</p>
      </DetailDialog>,
      { fetch: fakeApi({}) },
    );

    expect(screen.queryByText("Body")).toBeNull();
    expect(screen.getByText("S")).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Open" }));

    expect(await screen.findByText("Body")).toBeVisible();
    expect(screen.getByRole("dialog", { name: "T" })).toBeVisible();

    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["detail.layer.close"] }),
    );

    await waitFor(() => {
      expect(screen.queryByText("Body")).toBeNull();
    });
  });

  it("DL4: the body stays mounted while the layer plays its exit", async () => {
    renderWithProviders(
      <DetailDialog title="T" description="D" summary="S" triggerLabel="Open">
        <p>Body</p>
      </DetailDialog>,
      { fetch: fakeApi({}) },
    );
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    await screen.findByText("Body");

    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["detail.layer.close"] }),
    );

    expect(screen.getByText("Body")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("Body")).toBeNull();
    });
  });

  it("DL5: a press on the backdrop of an inner dialog closes the inner dialog only", async () => {
    renderWithProviders(
      <DetailDialog title="T" description="D" summary="S" triggerLabel="Open">
        <Dialog>
          <DialogTrigger
            render={(props) => <Button {...props}>Inner open</Button>}
          />
          <DialogContent>
            <DialogTitle>Inner</DialogTitle>
            <DialogBody>Inner body</DialogBody>
          </DialogContent>
        </Dialog>
      </DetailDialog>,
      { fetch: fakeApi({}) },
    );
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Inner open" }),
    );
    await screen.findByRole("dialog", { name: "Inner" });

    const backdrops = document.querySelectorAll('[data-part="backdrop"]');
    await userEvent.click(backdrops[backdrops.length - 1] as HTMLElement);

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Inner" })).toBeNull();
    });
    await expect(
      waitFor(
        () => {
          expect(screen.queryByRole("dialog", { name: "T" })).toBeNull();
        },
        { timeout: 600 },
      ),
    ).rejects.toThrow();
  });
});
