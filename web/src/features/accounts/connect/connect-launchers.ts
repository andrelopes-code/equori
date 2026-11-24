import { launchPluggy } from "@/features/accounts/connect/pluggy-launcher";
import type { MessageKey } from "@/i18n/catalog.en";

export interface ConnectLauncher {
  // Opens the aggregator's dialog and answers the item reference, or null when it closes.
  launch: (token: string, language: string) => Promise<string | null>;
  // The site where the reader authorizes the bank.
  portalUrl: string;
  portalLabel: MessageKey;
  steps: readonly MessageKey[];
}

// One entry per aggregator with a connect dialog, by aggregator id (docs/contributing/regions.md).
export const connectLaunchers: Partial<Record<string, ConnectLauncher>> = {
  pluggy: {
    launch: launchPluggy,
    portalUrl: "https://meu.pluggy.ai",
    portalLabel: "links.connect.pluggy.open",
    steps: [
      "links.connect.pluggy.authorize",
      "links.connect.pluggy.login",
      "links.connect.pluggy.choose",
    ],
  },
};
