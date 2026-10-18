const settingsFields =
  /^(card_account_id|postings\[\d+\]\.(account_id|statement))$/;

export function fieldTarget(
  field: string,
): { kind: "settings" } | { kind: "field"; name: string } {
  if (settingsFields.test(field)) return { kind: "settings" };
  return { kind: "field", name: field };
}
