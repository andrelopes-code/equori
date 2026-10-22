import { kinds } from "@/features/accounts/account-kinds";
import type { Kind } from "@/features/accounts/account-kinds";

export interface AccountFormSearch {
  kind?: Kind;
  // A name to start from, such as an external account's.
  name?: string;
  // Where a successful create returns: the links page, to link the new account to the external
  // account on its connection.
  return?: "links";
  external?: string;
  connection?: string;
}

export function validateAccountFormSearch(
  raw: Record<string, unknown>,
): AccountFormSearch {
  const kind = kinds.find((k) => k === raw.kind);
  const name =
    typeof raw.name === "string" && raw.name.trim() !== ""
      ? raw.name.slice(0, 120)
      : undefined;
  return {
    ...(kind === undefined ? {} : { kind }),
    ...(name === undefined ? {} : { name }),
    ...(raw.return === "links" ? { return: "links" as const } : {}),
    ...(typeof raw.external === "string" ? { external: raw.external } : {}),
    ...(typeof raw.connection === "string"
      ? { connection: raw.connection }
      : {}),
  };
}
