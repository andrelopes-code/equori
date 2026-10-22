import { queryOptions } from "@tanstack/react-query";

// ADR 013: the catalogue's PNG logos, one per file named by ISPB. Vite emits each as an asset
// of the binary; only the URLs are in the bundle, and a browser fetches a logo when it draws it.
const files = import.meta.glob<string>(
  "/node_modules/logos-bancos-br/logos/png/*.png",
  { eager: true, query: "?url", import: "default" },
);
const urlOfFile = new Map(
  Object.entries(files).map(([path, url]) => [path.slice(-12, -4), url]),
);

// cdn-index.min.json maps an ISPB to [COMPE, name, formats, ISPB of the shared file]: bit 1
// of formats is the PNG, and a cooperative affiliate names the file of its system.
export type LogoIndex = Record<string, readonly (string | number | null)[]>;

const png = 1;

export async function loadLogoIndex(): Promise<LogoIndex> {
  const index = await import("logos-bancos-br/data/cdn-index.min.json");
  return index.default.institutions;
}

export const logoIndexQuery = queryOptions({
  queryKey: ["institutions", "logo-index"] as const,
  queryFn: loadLogoIndex,
  staleTime: Infinity,
});

export function ispbOf(
  institution:
    { identifier?: { scheme: string; identifier: string } } | undefined,
): string | undefined {
  return institution?.identifier?.scheme === "br_ispb"
    ? institution.identifier.identifier
    : undefined;
}

export function logoURL(
  index: LogoIndex,
  ispb: string | undefined,
): string | undefined {
  if (ispb === undefined) return undefined;
  const [, , formats, shared] = index[ispb] ?? [];
  if (typeof formats !== "number" || (formats & png) === 0) return undefined;
  return urlOfFile.get(typeof shared === "string" ? shared : ispb);
}

export interface InstitutionIdentifier {
  scheme: string;
  identifier: string;
}

// ADR 013: the resolver of a scheme maps an identifier to a logo; a scheme without one has none.
export function logoOf(
  id: InstitutionIdentifier | null | undefined,
  index: LogoIndex | undefined,
): string | undefined {
  if (id === null || id === undefined || index === undefined) return undefined;
  switch (id.scheme) {
    case "br_ispb":
      return logoURL(index, id.identifier);
    default:
      return undefined;
  }
}
