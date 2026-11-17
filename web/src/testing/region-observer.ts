// A ResizeObserver that reports the shell's page region at the given width and nothing else:
// jsdom lays nothing out. A test stubs the global with it and restores the global afterwards.
export function regionObserver(width: number): typeof ResizeObserver {
  return class extends ResizeObserver {
    private readonly notify: () => void;

    constructor(callback: ResizeObserverCallback) {
      super(callback);
      this.notify = () => {
        callback([], this);
      };
    }

    override observe(element: Element) {
      if (!element.matches("main[data-part='main']")) return;

      element.getBoundingClientRect = () => new DOMRect(0, 0, width, 600);
      this.notify();
    }
  };
}
