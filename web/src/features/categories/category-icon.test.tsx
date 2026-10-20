import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  CategoryIcon,
  categoryIconNames,
} from "@/features/categories/category-icon";

describe("CategoryIcon", () => {
  it("draws each of the 79 curated icons with distinct paths", () => {
    expect(categoryIconNames).toHaveLength(79);
    for (const name of categoryIconNames) {
      const { container, unmount } = render(<CategoryIcon name={name} />);
      const paths = [...container.querySelectorAll("path")].map((p) =>
        p.getAttribute("d"),
      );
      expect(paths.length).toBeGreaterThan(0);
      expect(new Set(paths).size).toBe(paths.length);
      unmount();
    }
  });
});
