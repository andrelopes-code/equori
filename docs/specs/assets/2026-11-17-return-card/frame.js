// FIXED FILE: do not edit. Builds the mock page from mock.json: the same regions, controls
// and note tables on every use.
import { validate } from "./validate.js";

// The proposal pane shows the section with this margin of the app's background around it.
const MARGIN = 24;
const OVERLAY_MIN_HEIGHT = 720;

// Note tables, in fixed order: [key in mock.notes, title, [[field, column title]...]].
const NOTE_TABLES = [
  [
    "questions",
    "User questions",
    [
      ["question", "Question"],
      ["decision", "Decision it supports"],
      ["block", "Block that answers"],
    ],
  ],
  [
    "inventory",
    "Data inventory",
    [
      ["datum", "Datum on the current screen"],
      ["now", "Where it is now"],
      ["destination", "Destination in the mock"],
      ["reason", "Reason"],
    ],
  ],
  [
    "responsive",
    "Phone forms",
    [
      ["block", "Block"],
      ["desktop", "Desktop"],
      ["phone", "Phone"],
      ["leaves", "What leaves or shortens"],
    ],
  ],
  [
    "reused",
    "Reused components",
    [
      ["component", "Component"],
      ["draws", "What it draws by itself"],
      ["nesting", "Surface nesting"],
    ],
  ],
  [
    "decisions",
    "Embedded decisions",
    [
      ["decision", "Decision"],
      ["reason", "Reason"],
    ],
  ],
  [
    "derivations",
    "Client derivations",
    [
      ["value", "Value"],
      ["rule", "Rule"],
      ["test", "Test"],
    ],
  ],
];

const load = (path) => fetch(path, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null));
const mock = await load("mock.json");
const root = await load("theme/root.json").catch(() => null);
const query = new URLSearchParams(location.search);
const recommended = mock.concepts.find((c) => c.recommended) ?? mock.concepts[0];

const view = {
  concept: mock.chosen || query.get("concept") || recommended.id,
  state: query.get("state") || mock.states[0].id,
  overlay: query.get("overlay") || "",
  scheme: query.get("scheme") || mock.schemes[0],
  theme: query.get("theme") || mock.themes?.[0] || "",
  width: query.get("width") || "desktop",
  compare: query.get("compare") || "1",
};

const MAX_SEGMENTS = 5;

// Controls, in fixed order and with fixed names.
const CONTROLS = [
  [
    "concept",
    "Concept",
    mock.chosen ? [] : mock.concepts.map((c) => [c.id, `${c.id.toUpperCase()} · ${c.name}`]),
  ],
  ["state", "State", mock.states.map((s) => [s.id, s.name])],
  ["overlay", "Overlay", [["", "None"], ...(mock.overlays ?? []).map((o) => [o.id, o.name])]],
  ["scheme", "Scheme", mock.schemes.map((s) => [s, s])],
  ["theme", "Theme", (mock.themes ?? []).map((t) => [t, t])],
  [
    "width",
    "Width",
    [
      ["desktop", `Desktop ${mock.widths.desktop}`],
      ["phone", `Phone ${mock.widths.phone}`],
    ],
  ],
  [
    "compare",
    "Compare",
    [
      ["1", "Current and proposal"],
      ["0", "Proposal only"],
    ],
  ],
];

document.title = `Mock · ${mock.title}`;
render();

function render() {
  document.documentElement.dataset.mkScheme = view.scheme;
  history.replaceState(null, "", `?${new URLSearchParams(view)}`);

  fill("mk-head", head());
  fill("mk-controls", CONTROLS.map(control));
  fill("mk-problems", problems());
  fill("mk-concepts", concepts());
  fill("mk-compare", compare());
  fill("mk-notes", notes());
}

function head() {
  const status =
    mock.status === "approved"
      ? `Approved ${mock.approved ?? ""}`
      : `Draft · round ${mock.round ?? 1}`;
  const source = [mock.source?.url, mock.source?.commit].filter(Boolean).join(" · ");

  return [
    el("h1", { class: "mk-title" }, mock.title),
    el("span", { class: "mk-status", "data-status": mock.status }, status),
    el("span", { class: "mk-source" }, source),
  ];
}

function control([key, name, options]) {
  const label = el("span", { class: "mk-label" }, name);

  // A control with one value keeps its place, so the bar reads the same on every mock.
  if (options.length < 2) {
    const fixed =
      key === "concept" && mock.chosen
        ? `${mock.chosen.toUpperCase()} · chosen`
        : (options[0]?.[1] ?? "None");

    return el("div", { class: "mk-control" }, label, el("span", { class: "mk-fixed" }, fixed));
  }

  // Above this count a row of buttons is wider than the page: the control is a select.
  if (options.length > MAX_SEGMENTS) {
    const select = el(
      "select",
      { class: "mk-select", "aria-label": name },
      ...options.map(([value, text]) => {
        return el("option", view[key] === value ? { value, selected: "" } : { value }, text);
      }),
    );
    select.addEventListener("change", () => {
      view[key] = select.value;
      render();
    });

    return el("div", { class: "mk-control" }, label, select);
  }

  const buttons = options.map(([value, text]) => {
    const button = el(
      "button",
      { type: "button", "aria-pressed": String(view[key] === value) },
      text,
    );
    button.addEventListener("click", () => {
      view[key] = value;
      render();
    });

    return button;
  });

  return el("div", { class: "mk-control" }, label, el("div", { class: "mk-segment" }, ...buttons));
}

function problems() {
  const found = validate(mock, root);
  if (found.length === 0) return [];

  return [
    el("h2", { class: "mk-h" }, "Incomplete"),
    el("ul", { class: "mk-problems" }, ...found.map((text) => el("li", {}, text))),
  ];
}

function concepts() {
  if (mock.chosen) {
    const chosen = mock.concepts.find((c) => c.id === mock.chosen);

    return [
      el("h2", { class: "mk-h" }, "Chosen concept"),
      el(
        "p",
        { class: "mk-chosen" },
        `${chosen.id.toUpperCase()} · ${chosen.name}. ${chosen.answers ?? ""}`,
      ),
    ];
  }

  const columns = [
    ["id", "Concept"],
    ["name", "Name"],
    ["organizes", "Organizes by"],
    ["answers", "Answers"],
    ["costs", "Costs"],
    ["recommended", "Recommended"],
  ];
  const rows = mock.concepts.map((c) => ({
    ...c,
    id: c.id.toUpperCase(),
    recommended: c.recommended ? "Yes" : "",
  }));

  return [el("h2", { class: "mk-h" }, "Concepts"), table(columns, rows)];
}

function compare() {
  const viewport = mock.widths[view.width];
  const container = nearest(root?.container, viewport) ?? viewport;
  const rootPx = nearest(root?.rootFontPx, viewport);
  const facts = `${viewport} px viewport · ${container} px section · root ${rootPx ?? "?"} px`;
  const panes = [];

  if (view.compare === "1") panes.push(currentPane(viewport, facts));
  panes.push(proposalPane(viewport, container, facts));

  return [el("h2", { class: "mk-h" }, "Comparison"), el("div", { class: "mk-panes" }, ...panes)];
}

// The current screen is a capture of the real screen answered by the same fixtures.
function currentPane(viewport, facts) {
  const names = ["current", view.state, viewport, view.scheme, view.theme].filter(Boolean);
  const image = el("img", { src: `shots/${names.join("-")}.png`, alt: "Current screen" });
  const clip = el("div", { class: "mk-clip" }, image);

  image.addEventListener("error", () => {
    clip.replaceChildren(
      el("p", { class: "mk-absent" }, "No capture of the current screen in this state."),
    );
  });

  return pane("Current", facts, null, clip);
}

function proposalPane(viewport, container, facts) {
  const { width, compare, ...params } = view;
  const src = `stage.html?${new URLSearchParams(params)}`;
  const clipWidth = Math.min(viewport, container + 2 * MARGIN);
  const frame = el("iframe", { src, title: "Proposal", width: viewport, height: 400 });

  // The iframe keeps the full viewport width so media queries answer as on the real screen;
  // the pane shows only the section and its margin.
  frame.style.marginInlineStart = `${-(viewport - clipWidth) / 2}px`;
  frame.addEventListener("load", () => fit(frame));

  const clip = el("div", { class: "mk-clip" }, frame);
  clip.style.inlineSize = `${clipWidth}px`;

  return pane("Proposal", facts, src, clip);
}

function pane(name, facts, href, body) {
  const caption = el(
    "figcaption",
    { class: "mk-caption" },
    el("strong", {}, name),
    el("span", {}, facts),
  );
  if (href) caption.append(el("a", { href, target: "_blank" }, "Open alone"));

  return el("figure", { class: "mk-pane" }, caption, body);
}

function fit(frame) {
  const stage = frame.contentDocument.getElementById("stage");
  const resize = () => {
    const height = Math.ceil(stage.getBoundingClientRect().bottom);
    frame.height = view.overlay ? Math.max(height, OVERLAY_MIN_HEIGHT) : height;
  };

  new ResizeObserver(resize).observe(stage);
  resize();
}

function notes() {
  const priority = mock.notes?.priority;
  const order = priority?.order?.length
    ? priority.order.map((b, i) => `${i + 1}. ${b}`).join("   ")
    : "";
  const confirmed = priority?.confirmed ? `Confirmed: ${priority.confirmed}` : "";
  const blocks = [
    el(
      "div",
      {},
      el("h2", { class: "mk-h" }, "Block priority"),
      order ? el("p", { class: "mk-chosen" }, `${order}. ${confirmed}`) : missing(),
    ),
  ];

  for (const [key, title, columns] of NOTE_TABLES) {
    const rows = mock.notes?.[key] ?? [];
    blocks.push(
      el(
        "div",
        {},
        el("h2", { class: "mk-h" }, title),
        rows.length ? table(columns, rows) : missing(),
      ),
    );
  }

  return [el("div", { class: "mk-notes" }, ...blocks)];
}

function missing() {
  return el("p", { class: "mk-missing" }, "Nothing recorded.");
}

function table(columns, rows) {
  const head = el("tr", {}, ...columns.map(([, title]) => el("th", {}, title)));
  const body = rows.map((row) =>
    el("tr", {}, ...columns.map(([field]) => el("td", {}, row[field] ?? ""))),
  );

  return el("table", { class: "mk-table" }, el("thead", {}, head), el("tbody", {}, ...body));
}

function nearest(values, width) {
  if (!values) return undefined;

  const keys = Object.keys(values).map(Number);
  const key = keys.reduce((a, b) => (Math.abs(b - width) < Math.abs(a - width) ? b : a));

  return values[key];
}

function fill(id, children) {
  document.getElementById(id).replaceChildren(...children);
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  node.append(...children);

  return node;
}
