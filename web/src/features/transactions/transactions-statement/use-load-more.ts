import { useEffect, useRef } from "react";

// Asks for the next page when the element comes within one screen of the viewport, so the page's
// own scroller pages the list (mobile.md M3).
export function useLoadMore(active: boolean, loadMore: () => void) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = ref.current;
    if (!active || target === null) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore();
      },
      { rootMargin: "100% 0px" },
    );
    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [active, loadMore]);

  return ref;
}
