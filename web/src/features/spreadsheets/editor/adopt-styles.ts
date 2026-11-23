// The page's Content-Security-Policy refuses a style element (ADR 028, W12), and Univer writes
// its theme variables, its cursor rules and its notices into style elements of the document head. Each
// refused element is applied as a constructed style sheet, which the policy allows because only
// the application's own script can create one. Returns the function that removes them.
export function adoptRefusedStyles(): () => void {
  const adopted = new Map<HTMLStyleElement, CSSStyleSheet>();

  function adopt(element: HTMLStyleElement) {
    // A style element the policy accepted holds a sheet of its own.
    if (element.sheet !== null) return;

    let sheet = adopted.get(element);
    if (sheet === undefined) {
      sheet = new CSSStyleSheet();
      adopted.set(element, sheet);
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    }

    sheet.replaceSync(element.textContent);
  }

  function release(element: HTMLStyleElement) {
    const sheet = adopted.get(element);
    if (sheet === undefined) return;

    adopted.delete(element);
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
      (s) => s !== sheet,
    );
  }

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.removedNodes)
        if (node instanceof HTMLStyleElement) release(node);

      for (const node of record.addedNodes)
        if (node instanceof HTMLStyleElement) adopt(node);

      // A text written into an element already in the head.
      const owner =
        record.target instanceof HTMLStyleElement
          ? record.target
          : record.target.parentElement;
      if (owner instanceof HTMLStyleElement && owner.isConnected) adopt(owner);
    }
  });

  // A library of the editor's chunk writes its element when the chunk loads, before this call.
  document.head.querySelectorAll("style").forEach(adopt);

  observer.observe(document.head, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  return () => {
    observer.disconnect();
    [...adopted.keys()].forEach(release);
  };
}
