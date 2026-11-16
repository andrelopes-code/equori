import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const css = readFileSync(
  new URL("./equori-glass.gen.css", import.meta.url),
  "utf8",
);

const table = '[data-ui="table"]';
const inset = '[data-ui="table"][data-edges="inset"]';

test("a pinned body cell paints nothing and blurs only while content passes under it", () => {
  assert.match(
    css,
    new RegExp(
      String.raw`@supports \(container-type: scroll-state\) \{[^@]*${escape(table)} \[data-part="body"\] \[data-sticky="end"\],[^{]*\{\s*background: transparent;`,
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

test("the scroller of an inset table with a group row is an inline-size container", () => {
  assert.match(
    css,
    new RegExp(
      String.raw`${escape(inset)}:has\(\[data-part="group-row"\]\) \[data-part="scroll"\] \{\s*container-type: inline-size;`,
    ),
  );
  assert.match(
    css,
    /@supports \(container-type: scroll-state\) \{[^@]*:has\(\[data-part="group-row"\]\) \[data-part="scroll"\] \{\s*container-type: inline-size scroll-state;/,
  );
});

test("the content of a group band stays in the scroller's view and holds the cell padding", () => {
  assert.match(
    css,
    new RegExp(
      String.raw`${escape(inset)} \[data-part="group-header"\] \{\s*padding-inline: 0;`,
    ),
  );
  assert.match(
    css,
    new RegExp(
      String.raw`${escape(inset)} \[data-part="group-content"\] \{\s*position: sticky;\s*inset-inline-start: 0;\s*box-sizing: border-box;\s*inline-size: 100cqi;\s*padding-inline: var\(--slotted-table-cell-padding-inline`,
    ),
  );
});

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}
