// Whether an origin is reachable only from this computer or network: loopback, RFC 1918,
// link-local, localhost or a .local name. Services that connect from the internet cannot reach it.
export function isPrivateOrigin(origin: string): boolean {
  let host: string;
  try {
    host = new URL(origin).hostname;
  } catch {
    return false;
  }
  if (host === "localhost" || host.endsWith(".local") || host === "[::1]")
    return true;
  const parts = host.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p)))
    return false;
  const [a = -1, b = -1] = parts;
  return (
    a === 127 ||
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254)
  );
}
