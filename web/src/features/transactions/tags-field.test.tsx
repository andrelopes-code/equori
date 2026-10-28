import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { TagsField } from "@/features/transactions/tags-field";
import { fakeApi } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

let last: string[] = [];

function Host() {
  const [value, setValue] = useState<string[]>([]);
  return (
    <TagsField
      tags={["travel", "work"]}
      value={value}
      placeholder="Tags"
      onChange={(next) => {
        last = next;
        setValue(next);
      }}
    />
  );
}

describe("TagsField", () => {
  it("offers the tags in use and takes a new one typed whole", async () => {
    renderWithProviders(<Host />, { fetch: fakeApi({}) });
    const input = screen.getByPlaceholderText("Tags");
    await userEvent.type(input, "tra");
    await userEvent.click(
      await screen.findByRole("option", { name: "travel" }),
    );
    expect(last).toEqual(["travel"]);
    await userEvent.type(input, "gifts{Enter}");
    expect(last).toEqual(["travel", "gifts"]);
  });
});
