// The avatar letters of a description: the first letter of its first two words, upper case.
export function initials(description: string): string {
  return description
    .split(/\s+/)
    .filter((word) => word !== "")
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? "")
    .join("")
    .toLocaleUpperCase();
}
