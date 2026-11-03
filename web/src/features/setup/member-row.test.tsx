import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MemberRow } from "@/features/setup/member-row";
import { fakeApi } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

const member = {
  member_id: 2,
  email: "bia@example.com",
  role: "write" as const,
  created_at: "2026-10-20T12:00:00Z",
};

function renderRow(display_name?: string) {
  renderWithProviders(
    <MemberRow
      member={display_name === undefined ? member : { ...member, display_name }}
      own={false}
      owner={false}
      onRole={() => undefined}
      onRemove={() => undefined}
    />,
    { fetch: fakeApi({}) },
  );
}

describe("MemberRow", () => {
  it("names a member by the display name and keeps the email in the description", () => {
    renderRow("Bia Souza");

    expect(screen.getByText("Bia Souza")).toBeVisible();
    expect(screen.getByText(/bia@example\.com · /)).toBeVisible();
  });

  it("names a member without a display name by the email", () => {
    renderRow();

    expect(screen.getByText("bia@example.com")).toBeVisible();
  });
});
