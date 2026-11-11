import type { components } from "@/api/schema.gen";

type Account = components["schemas"]["Account"];

// What a draft needs before it can be shown or recorded.
export interface CaptureSetup {
  accounts: Account[];
  base: string;
  scale: (code: string) => number;
}

// null until the accounts, the base currency and the instrument scales have loaded.
export function captureSetup(
  accounts: Account[] | undefined,
  base: string | undefined,
  scale: ((code: string) => number) | null,
): CaptureSetup | null {
  if (accounts === undefined || base === undefined || scale === null) {
    return null;
  }

  return { accounts, base, scale };
}
