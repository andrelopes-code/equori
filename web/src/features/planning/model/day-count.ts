const dayMs = 86_400_000;

// Calendar days from one ISO date to another: negative when `to` is earlier.
export function dayCount(from: string, to: string): number {
  return Math.round((utc(to) - utc(from)) / dayMs);
}

function utc(iso: string): number {
  const [year = 0, month = 1, day = 1] = iso.split("-").map(Number);

  return Date.UTC(year, month - 1, day);
}
