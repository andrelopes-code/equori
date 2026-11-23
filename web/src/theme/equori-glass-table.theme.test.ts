import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const css = readFileSync(
  new URL("./equori-glass.gen.css", import.meta.url),
  "utf8",
);

const table = '[data-ui="table"]';

test("a pinned body cell takes no sticky fill and blurs only while content passes under it", () => {
  assert.match(
    css,
    new RegExp(
      String.raw`@supports \(container-type: scroll-state\) \{[^@]*${escape(table)} \[data-part="body"\] \[data-sticky="end"\],[^{]*\{\s*--slotted-table-sticky-surface: transparent;`,
    ),
  );
  for (const side of ["end", "start"]) {
    assert.match(
      css,
      new RegExp(
        String.raw`@container scroll-state\(scrollable: inline-${side}\) \{[^@]*${escape(table)} \[data-part="body"\] \[data-sticky="${side}"\] \{[^}]*backdrop-filter: blur\(var\(--glass-blur-strong\)\) saturate\(100%\)`,
      ),
    );
  }
});

test("a pinned body cell takes the card's opaque fill without transparency", () => {
  assert.match(
    css,
    new RegExp(
      String.raw`@media \(prefers-reduced-transparency: reduce\) \{[^@]*${escape(table)} \[data-part="body"\] \[data-sticky="end"\],[^{]*\{[^}]*backdrop-filter: none;[^}]*background-color: var\(--glass-fill-card\)`,
    ),
  );
});

test("the scroller of a table with a group row is a scroll-state container of its inline size", () => {
  assert.match(
    css,
    /@supports \(container-type: scroll-state\) \{[^@]*\[data-part="scroll"\]:has\(\[data-part="group-row"\]\) \{\s*container-type: inline-size scroll-state;/,
  );
});

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}
