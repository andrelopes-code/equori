// The key that joins the entries of one series: the category and the payee, or the category and
// the description without digits or punctuation when there is no payee, so the parts of an
// instalment ("Store 1/3", "Store 2/3") join (net worth forecast design, Series).
export function seriesKey(
  category: string,
  payee: string | undefined,
  description: string,
): string {
  if (payee !== undefined && payee !== "") return `${category}|p:${payee}`;

  const words = description
    .toLocaleLowerCase()
    .replace(/[^\p{L}]+/gu, " ")
    .trim();

  return `${category}|d:${words}`;
}
