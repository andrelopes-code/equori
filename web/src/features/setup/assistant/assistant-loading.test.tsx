import { render } from "@testing-library/react";
import { expect, it } from "vitest";

import { AssistantLoading } from "@/features/setup/assistant/assistant-loading";
import pane from "@/features/setup/pages/settings-page.module.css";

// The region is one child of the pane: without the pane's own gap its status and cards touch.
it("spaces the placeholders as the pane spaces its groups", () => {
  const { container } = render(<AssistantLoading />);

  const region = container.querySelector('[data-part="region"]');

  expect(pane.pane).toBeTruthy();
  expect(region?.className).toContain(pane.pane);
  expect(region?.children.length).toBeGreaterThanOrEqual(4);
});
