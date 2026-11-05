// 32 symbols without I, O, 0 and 1: a byte masked with 31 picks one without bias (export design T9).
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const groups = 5;
const groupSize = 5;

// A passphrase of 25 symbols (125 bits) in five groups of five, drawn in the browser.
export function generatePassphrase(
  fill: (bytes: Uint8Array) => Uint8Array = (bytes) =>
    crypto.getRandomValues(bytes),
): string {
  const bytes = fill(new Uint8Array(groups * groupSize));
  const symbols = Array.from(bytes, (byte) => alphabet.charAt(byte & 31));
  return Array.from({ length: groups }, (_, group) =>
    symbols.slice(group * groupSize, (group + 1) * groupSize).join(""),
  ).join("-");
}
