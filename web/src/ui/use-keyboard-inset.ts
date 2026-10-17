import { useEffect } from "react";

// A literal is unavoidable: no theme token measures the virtual keyboard, so the visualViewport difference is published as --keyboard-inset.
export function useKeyboardInset(active: boolean): void {
  useEffect(() => {
    const viewport = window.visualViewport as VisualViewport | null | undefined;
    if (!active || viewport === null || viewport === undefined) return;
    const root = document.documentElement;
    const update = () => {
      const inset = window.innerHeight - viewport.height - viewport.offsetTop;
      root.style.setProperty(
        "--keyboard-inset",
        `${String(Math.max(0, inset))}px`,
      );
    };
    update();
    viewport.addEventListener("resize", update);
    return () => {
      viewport.removeEventListener("resize", update);
      root.style.removeProperty("--keyboard-inset");
    };
  }, [active]);
}
