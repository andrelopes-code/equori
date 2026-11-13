import { openingLabel } from "@/features/accounts/account-form/opening-label";
import {
  asksParent,
  classOf,
  liquidCapable,
  yieldCapable,
} from "@/features/accounts/model/account-kinds";
import type { Kind } from "@/features/accounts/model/account-kinds";
import type { MessageKey } from "@/i18n/catalog.en";

export interface KindStep {
  key: MessageKey;
  wrap?: MessageKey;
  own: boolean;
}

export interface KindFacts {
  side: "asset" | "liability";
  steps: readonly KindStep[];
  opensIn: "nav.cards" | "nav.accounts";
  liquid: boolean;
  countLabel: "kindPanel.cards" | "kindPanel.accounts";
  noneLabel: "kindPanel.noCards" | "kindPanel.noAccounts";
}

// Section 4: what the form asks for and where the account lands, from the predicates the form
// uses, in the order AccountForm renders its sections.
export function kindFacts(kind: Kind): KindFacts {
  const card = kind === "credit_card";

  return {
    side: classOf(kind),
    steps: stepsOf(kind),
    opensIn: card ? "nav.cards" : "nav.accounts",
    liquid: liquidCapable(kind),
    countLabel: card ? "kindPanel.cards" : "kindPanel.accounts",
    noneLabel: card ? "kindPanel.noCards" : "kindPanel.noAccounts",
  };
}

function stepsOf(kind: Kind): readonly KindStep[] {
  const brokerage = kind === "brokerage";
  // The brokerage's opening field shows only when the cash is its own (showOpening); its step
  // says so in a line short enough for the panel.
  const opening: KindStep = {
    key: brokerage
      ? "kindPanel.stepOwnCash"
      : openingLabel(kind, classOf(kind)),
    own: false,
  };

  return [
    { key: "kindPanel.stepIdentity", own: false },
    {
      key: asksParent(kind, "create", null)
        ? "kindPanel.stepDetails"
        : "kindPanel.stepDetailsNoParent",
      own: false,
    },
    ...(yieldCapable(kind)
      ? [{ key: "accountForm.yield" as const, own: true }]
      : []),
    ...(brokerage
      ? [
          {
            key: "kindPanel.stepCashMode" as const,
            wrap: "kindPanel.afterInstitution" as const,
            own: true,
          },
        ]
      : []),
    opening,
    ...(kind === "credit_card"
      ? [
          { key: "accountForm.billing" as const, own: true },
          { key: "accountForm.limitGroup" as const, own: true },
          { key: "accountForm.cards" as const, own: true },
        ]
      : []),
  ];
}
