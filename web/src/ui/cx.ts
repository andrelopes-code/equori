export type ClassValue = string | false | null | undefined;

/** Joins class names with one space; `false`, `null`, `undefined` and `""` are dropped. */
export function cx(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(" ");
}
