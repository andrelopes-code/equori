import { useEffect, useState } from "react";

interface OpenSheets {
  // The sheets of the feed that still hold a pending proposal.
  count: number;
  // No sheet footer intersects the feed.
  hidden: boolean;
}

const footerSelector = "[data-sheet-footer]";
const sheetSelector = "[data-open-sheet]";

// Watches the feed for open sheets and for whether any sheet footer is in view (spec 2026-11-15,
// section 6). The feed's sheets come and go with the messages, so a mutation observer rescans.
export function useOpenSheets(root: HTMLElement | null): OpenSheets {
  const [count, setCount] = useState(0);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (root === null) return;

    const inView = new Set<Element>();
    const watched = new Set<Element>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const { target, isIntersecting } of entries) {
          if (isIntersecting) inView.add(target);
          else inView.delete(target);
        }

        setHidden(inView.size === 0);
      },
      { root },
    );

    function scan() {
      const footers = new Set(root?.querySelectorAll(footerSelector));

      for (const footer of footers) {
        if (watched.has(footer)) continue;

        watched.add(footer);
        observer.observe(footer);
      }

      for (const footer of watched) {
        if (footers.has(footer)) continue;

        watched.delete(footer);
        observer.unobserve(footer);

        if (inView.delete(footer)) setHidden(inView.size === 0);
      }

      setCount(root?.querySelectorAll(sheetSelector).length ?? 0);

      // A footer not yet reported counts as in view, so a new sheet does not flash the dock.
      if (footers.size === 0) setHidden(true);
    }

    const mutations = new MutationObserver(scan);

    mutations.observe(root, {
      childList: true,
      subtree: true,
      attributeFilter: ["data-open-sheet"],
    });
    scan();

    return () => {
      mutations.disconnect();
      observer.disconnect();
    };
  }, [root]);

  return { count, hidden };
}
