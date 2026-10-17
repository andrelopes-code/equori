const WIDTH_CONDITION = /^\(\s*(min|max)-width\s*:\s*(\d+(?:\.\d+)?)px\s*\)$/;

function evaluate(query: string, width: number): boolean {
  const conditions = query.trim().split(/\s+and\s+/i);
  return conditions.every((condition) => {
    const match = WIDTH_CONDITION.exec(condition.trim());
    if (match === null) {
      return false;
    }
    const limit = Number(match[2]);
    return match[1] === "min" ? width >= limit : width <= limit;
  });
}

class FakeMediaQueryList extends EventTarget {
  readonly media: string;
  matches: boolean;
  onchange: ((event: Event) => void) | null = null;

  constructor(media: string, width: number) {
    super();
    this.media = media;
    this.matches = evaluate(media, width);
  }

  addListener(listener: EventListener): void {
    this.addEventListener("change", listener);
  }

  removeListener(listener: EventListener): void {
    this.removeEventListener("change", listener);
  }

  update(width: number): void {
    const next = evaluate(this.media, width);
    if (next === this.matches) {
      return;
    }
    this.matches = next;
    const event = new Event("change");
    Object.defineProperties(event, {
      matches: { value: next },
      media: { value: this.media },
    });
    this.onchange?.(event);
    this.dispatchEvent(event);
  }
}

// Module state is test-only: one jsdom window per test file, reset by setup.ts.
let currentWidth = 1280;
const queries = new Set<FakeMediaQueryList>();

// setViewport sets the window width and re-evaluates every query created by window.matchMedia.
export function setViewport(width: number): void {
  currentWidth = width;
  window.innerWidth = width;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (media: string): MediaQueryList => {
      const list = new FakeMediaQueryList(media, currentWidth);
      queries.add(list);
      return list;
    },
  });
  for (const list of queries) {
    list.update(width);
  }
}
