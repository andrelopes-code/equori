// FIXED FILE: do not edit. Mounts one template of design.html under the real root attributes.
(async () => {
  const query = new URLSearchParams(location.search);
  const page = document.documentElement;
  const stage = document.getElementById("stage");

  const fail = (message) => {
    page.dataset.error = message;
    stage.innerHTML = `<p id="stage-error">${message}</p>`;
  };

  const load = (path, kind) => fetch(path, { cache: "no-store" }).then((r) => r[kind]());

  try {
    const [mock, root, design] = await Promise.all([
      load("mock.json", "json"),
      load("theme/root.json", "json"),
      load("design.html", "text"),
    ]);

    for (const [name, value] of Object.entries(root.htmlAttrs)) page.setAttribute(name, value);
    if (root.bodyClass) document.body.className = root.bodyClass;

    // The value measured at the viewport width nearest to this one.
    const nearest = (table) => {
      const widths = Object.keys(table).map(Number);
      const key = widths.reduce((a, b) =>
        Math.abs(b - innerWidth) < Math.abs(a - innerWidth) ? b : a,
      );

      return table[key];
    };

    // The real ancestors of the section, as wrappers without layout: inherited styles and
    // tokens they set reach the design. A query container keeps a box of its real width.
    let parent = document.body;
    for (const { tag, attrs, containerWidth } of nearest(root.ancestors)) {
      const wrapper = document.createElement(tag);
      for (const [name, value] of Object.entries(attrs)) wrapper.setAttribute(name, value);

      if (containerWidth) {
        wrapper.dataset.mockContainer = "";
        wrapper.style.setProperty("inline-size", `${containerWidth}px`, "important");
      } else {
        wrapper.dataset.mockChain = "";
      }

      parent.prepend(wrapper);
      parent = wrapper;
    }

    parent.append(stage);

    if (mock.schemeAttr) page.setAttribute(mock.schemeAttr, query.get("scheme") || mock.schemes[0]);
    if (mock.themeAttr) page.setAttribute(mock.themeAttr, query.get("theme") || mock.themes[0]);
    if (mock.stageBackground) document.body.style.background = mock.stageBackground;

    const concept = mock.chosen || query.get("concept") || mock.concepts[0].id;
    const state = query.get("state") || mock.states[0].id;
    const overlay = query.get("overlay");
    const source = new DOMParser().parseFromString(design, "text/html");

    // A template without data-concept serves every concept. A template with data-width
    // ("phone" or "desktop") serves one width, for an app that changes its markup by width.
    const form = `[data-width="${innerWidth <= mock.widths.phone ? "phone" : "desktop"}"]`;
    const pick = (attr) =>
      source.querySelector(`template[data-concept="${concept}"]${attr}${form}`) ??
      source.querySelector(`template[data-concept="${concept}"]${attr}:not([data-width])`) ??
      source.querySelector(`template:not([data-concept])${attr}${form}`) ??
      source.querySelector(`template:not([data-concept])${attr}:not([data-width])`);

    const body = pick(`[data-state="${state}"]`);
    if (!body)
      return fail(`design.html has no template for concept "${concept}", state "${state}"`);

    stage.append(document.importNode(body.content, true));

    if (overlay) {
      const layer = pick(`[data-overlay="${overlay}"]`);
      if (!layer) return fail(`design.html has no template for overlay "${overlay}"`);

      document.getElementById("overlay").append(document.importNode(layer.content, true));
    }

    // The section takes the width the real container has at this viewport width.
    stage.style.maxInlineSize = `${nearest(root.container)}px`;
    await document.fonts.ready;

    const measured = parseFloat(getComputedStyle(page).fontSize);
    const expected = nearest(root.rootFontPx);
    if (measured !== expected) {
      return fail(`root font size is ${measured} px here and ${expected} px on the real screen`);
    }

    page.dataset.ready = "1";
  } catch (error) {
    fail(String(error));
  }
})();
