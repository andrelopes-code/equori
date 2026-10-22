// A formatted amount of any scale-2 currency in either decimal convention: "1.234,56", "1,234.56".
const amountPattern = /\d[.,]\d{2}(?!\d)/g;

// Stores the choice the way PrivacyProvider reads it; call before rendering.
export function hideAmounts(): void {
  localStorage.setItem("equori.privacy", "hidden");
}

// Reads the markup, attributes included: an accessible name or a tooltip leaks as well as text.
export function expectNoAmounts(
  container: HTMLElement,
  known: readonly string[],
): void {
  // Coordinates of a drawing and machine-readable dates look like amounts and are not.
  const markup = container.innerHTML
    .replace(/<svg[\s\S]*?<\/svg>/g, "")
    .replace(/datetime="[^"]*"/g, "");
  const leaks = [
    ...known.filter((text) => markup.includes(text)),
    ...[...markup.matchAll(amountPattern)].map((m) => {
      const at = m.index;
      return markup.slice(Math.max(0, at - 20), at + m[0].length + 20);
    }),
  ];
  if (leaks.length > 0) {
    throw new Error(
      `${String(leaks.length)} amount(s) visible while hidden:\n${leaks
        .slice(0, 5)
        .map((leak) => `  ...${leak}...`)
        .join("\n")}`,
    );
  }
}
