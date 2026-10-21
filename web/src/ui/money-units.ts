// Workaround for Slotted finding "currency-field holds the amount as a float in major units":
// the field's number is read through its decimal text so no float reaches the API (O7).
export function minorFromMajor(major: number, scale: number): number {
  const [whole = "0", fraction = ""] = Math.abs(major)
    .toFixed(scale)
    .split(".");
  const minor = Number(whole + fraction.padEnd(scale, "0"));
  return major < 0 ? -minor : minor;
}

export function majorFromMinor(minor: number, scale: number): number {
  if (scale === 0) return minor;
  const digits = String(Math.abs(minor)).padStart(scale + 1, "0");
  const text = `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
  return minor < 0 ? -Number(text) : Number(text);
}
