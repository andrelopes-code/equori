import { useEffect } from "react";

// A link to a section or a term arrives before the page's text is drawn; once it is, the target
// of the address comes into view.
export function useHashTarget(ready: boolean): void {
  useEffect(() => {
    if (!ready) return;

    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id === "") return;

    document.getElementById(id)?.scrollIntoView();
  }, [ready]);
}
