// The accessible name of a field the form marks "(optional)" (forms.md F7), in the words of the
// language under test.
// Workaround for Slotted issue #41: the mark joins the label with no space in the name, so the
// space is optional here until the family writes one.
export function optionalName(label: string, word = "optional"): RegExp {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return new RegExp(`^${escaped} ?\\(${word}\\)$`);
}
