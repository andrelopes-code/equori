import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FormNotice } from "@/ui/form-notice";

describe("FormNotice", () => {
  it.each([
    ["danger", "alert", undefined],
    ["warning", "status", "warning"],
  ] as const)("announces a %s notice as role %s", (tone, role, given) => {
    render(
      <FormNotice {...(given === undefined ? {} : { tone: given })}>
        The name is taken.
      </FormNotice>,
    );

    const notice = screen.getByRole(role);

    expect(notice).toHaveTextContent("The name is taken.");
    expect(notice.closest('[data-ui="alert"]')).toHaveAttribute(
      "data-tone",
      tone,
    );
  });
});
