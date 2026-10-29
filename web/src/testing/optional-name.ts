// The accessible name of a field the form marks "(optional)" (forms.md F7), in the words of the
// language under test.
export function optionalName(label: string, word = "optional"): RegExp {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return new RegExp(`^${escaped} \\(${word}\\)$`);
}
