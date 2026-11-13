import { flushSync } from "react-dom";

const heroName = "data-hero-name";

// KC5: the scene of the chosen tile travels to the panel's stage. Exactly one element holds the
// name in each snapshot: the tile's scene before the update, the panel's new scene after it.
export function chooseKind(choose: () => void, from: Element | null): void {
  if (!canTransition(from)) {
    choose();

    return;
  }

  for (const holder of document.querySelectorAll(`[${heroName}]`)) {
    holder.removeAttribute(heroName);
  }

  from.setAttribute(heroName, "");

  document.startViewTransition({
    update: () => {
      flushSync(choose);
      from.removeAttribute(heroName);
    },
    types: ["kind"],
  });
}

function canTransition(from: Element | null): from is Element {
  return (
    from !== null &&
    "startViewTransition" in document &&
    !matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
