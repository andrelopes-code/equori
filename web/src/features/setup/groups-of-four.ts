export function groupsOfFour(text: string): string {
  return (text.match(/.{1,4}/g) ?? []).join(" ");
}
