import { Alert, AlertContent, AlertTitle } from "@slotted/react/alert";
import { Button } from "@slotted/react/button";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AlertActions } from "@/ui/alert-actions";

describe("AlertActions", () => {
  it("draws its buttons in the alert's tone at the small size", () => {
    render(
      <Alert tone="warning">
        <AlertContent>
          <AlertTitle>Title</AlertTitle>
        </AlertContent>
        <AlertActions tone="warning">
          <Button>Primary</Button>
          <Button variant="ghost">Other</Button>
        </AlertActions>
      </Alert>,
    );
    for (const name of ["Primary", "Other"]) {
      const button = screen.getByRole("button", { name });
      expect(button).toHaveAttribute("data-tone", "warning");
      expect(button).toHaveAttribute("data-size", "sm");
    }
    expect(screen.getByRole("button", { name: "Other" })).toHaveAttribute(
      "data-variant",
      "ghost",
    );
  });
});
