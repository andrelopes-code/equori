const units = [
  { unit: "byte", limit: 1024 },
  { unit: "kilobyte", limit: 1024 ** 2 },
  { unit: "megabyte", limit: 1024 ** 3 },
  { unit: "gigabyte", limit: Infinity },
] as const;

// A file size in the largest binary-based unit under 1024, written by Intl in the tag.
export function formatFileSize(bytes: number, tag: string): string {
  const index = units.findIndex(({ limit }) => bytes < limit);
  const value = bytes / 1024 ** index;
  return new Intl.NumberFormat(tag, {
    style: "unit",
    unit: units[index]?.unit ?? "byte",
    unitDisplay: "short",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatUploaded(iso: string, tag: string): string {
  return new Intl.DateTimeFormat(tag, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}
