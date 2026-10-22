import type { Client } from "openapi-fetch";

import { unwrap } from "@/api/problem";
import type { components, paths } from "@/api/schema.gen";
import type { AccountDraft } from "@/features/accounts/account-draft";
import { classOf, yieldCapable } from "@/features/accounts/account-kinds";
import { openingBalanceBody } from "@/features/accounts/api";
import type { MessageKey } from "@/i18n/catalog.en";

type AccountInput = components["schemas"]["AccountInput"];
type BillingCycleRule = components["schemas"]["BillingCycleRule"];

export type StepKey = "rule" | "limit" | "card" | "opening";

export interface Step {
  key: StepKey;
  run: (api: Client<paths>, accountId: string) => Promise<void>;
}

export const stepLabel: Record<StepKey, MessageKey> = {
  rule: "accountSetup.step.rule",
  limit: "accountSetup.step.limit",
  card: "accountSetup.step.card",
  opening: "accountSetup.step.opening",
};

export function accountInput(draft: AccountDraft): AccountInput {
  const kind = draft.kind ?? "checking";
  return {
    name: draft.name.trim(),
    class: classOf(kind),
    kind,
    currency: draft.currency,
    opened_on: draft.openedOn,
    ...(draft.institutionId === null
      ? {}
      : { institution_id: draft.institutionId }),
    ...(draft.parentId === null ? {} : { parent_id: draft.parentId }),
    yield_mode: yieldCapable(kind) && draft.yieldAuto ? "auto" : "none",
    ...(draft.color === null ? {} : { color: draft.color }),
  };
}

export function billingRuleBody(
  card: AccountDraft["card"],
  effectiveFrom: string,
): BillingCycleRule {
  return {
    effective_from: effectiveFrom,
    closing_mode: card.closingMode,
    ...(card.closingMode === "day"
      ? { closing_day: card.closingDay ?? 1 }
      : { closing_days_before_due: card.closingDaysBeforeDue ?? 1 }),
    due_day: card.dueDay ?? 1,
    closing_adjustment: card.closingAdjustment,
    due_date_adjustment: card.dueDateAdjustment,
    closing_day_assignment: card.assignment,
  };
}

// What follows the account's creation, in the order the backend needs it: a card's statements
// need its rule before the opening balance is billed on one (S23).
export function createAccountSteps(
  draft: AccountDraft,
  ids: { openingBalances: string },
): Step[] {
  const steps: Step[] = [];
  const isCard = draft.kind === "credit_card";
  const liability = draft.kind !== null && classOf(draft.kind) === "liability";
  if (isCard) {
    const card = draft.card;
    steps.push({
      key: "rule",
      run: async (api, id) => {
        await unwrap(
          await api.POST("/accounts/{id}/billing-cycle-rules", {
            params: { path: { id } },
            body: billingRuleBody(card, draft.openedOn.slice(0, 7)),
          }),
        );
      },
    });
    if (card.limit > 0) {
      steps.push({
        key: "limit",
        run: async (api, id) => {
          await unwrap(
            await api.POST("/accounts/{id}/credit-limits", {
              params: { path: { id } },
              body: {
                effective_from: draft.openedOn,
                amount: { amount: card.limit, currency: draft.currency },
              },
            }),
          );
        },
      });
    }
    for (const row of card.cards) {
      steps.push({
        key: "card",
        run: async (api, id) => {
          await unwrap(
            await api.POST("/accounts/{id}/cards", {
              params: { path: { id } },
              body: {
                holder: row.holder.trim(),
                last_four: row.lastFour,
                virtual: row.virtual,
              },
            }),
          );
        },
      });
    }
  }
  if (draft.opening > 0) {
    steps.push({
      key: "opening",
      run: async (api, id) => {
        const statement = isCard
          ? (
              await unwrap(
                await api.GET("/accounts/{id}/statement-placement", {
                  params: { path: { id }, query: { date: draft.openedOn } },
                }),
              )
            ).reference
          : undefined;
        await unwrap(
          await api.POST("/transactions", {
            body: openingBalanceBody(
              { id, currency: draft.currency },
              ids.openingBalances,
              liability ? -draft.opening : draft.opening,
              draft.openedOn,
              statement,
            ),
          }),
        );
      },
    });
  }
  return steps;
}
