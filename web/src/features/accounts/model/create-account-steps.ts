import type { Client } from "openapi-fetch";

import { unwrap } from "@/api/problem";
import type { components, paths } from "@/api/schema.gen";
import type { AccountDraft } from "@/features/accounts/model/account-draft";
import { classOf, yieldCapable } from "@/features/accounts/model/account-kinds";
import { openingBalanceBody } from "@/features/accounts/api";
import type { MessageKey } from "@/i18n/catalog.en";
import { faceBody, faceIsEmpty } from "@/ui/card-face/studio/face-draft";

type AccountInput = components["schemas"]["AccountInput"];
type BillingCycleRule = components["schemas"]["BillingCycleRule"];

export type StepKey = "rule" | "limit" | "card" | "face" | "cash" | "opening";

export interface Step {
  key: StepKey;
  run: (api: Client<paths>, accountId: string) => Promise<void>;
}

export const stepLabel: Record<StepKey, MessageKey> = {
  rule: "accountSetup.step.rule",
  limit: "accountSetup.step.limit",
  card: "accountSetup.step.card",
  face: "accountSetup.step.face",
  cash: "accountSetup.step.cash",
  opening: "accountSetup.step.opening",
};

// institutionId is the draft's own unless a pending institution was created for it.
export function accountInput(
  draft: AccountDraft,
  institutionId: string | null = draft.institutionId,
): AccountInput {
  const kind = draft.kind ?? "checking";
  return {
    name: draft.name.trim(),
    class: classOf(kind),
    kind,
    currency: draft.currency,
    opened_on: draft.openedOn,
    ...(institutionId === null ? {} : { institution_id: institutionId }),
    ...(draft.parentId === null || kind === "brokerage"
      ? {}
      : { parent_id: draft.parentId }),
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
  ids: { openingBalances: string; cashName: string },
): Step[] {
  const steps: Step[] = [];
  // Set by the step cash; a retry that starts at the step opening finds the child again.
  let cashId: string | undefined;
  const isCard = draft.kind === "credit_card";
  const isBrokerage = draft.kind === "brokerage";
  // BC16: money paid from an account of the institution needs neither a Caixa nor an opening.
  const hasCash = !isBrokerage || draft.cashMode !== "institution";
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
                ...(row.network === null ? {} : { network: row.network }),
              },
            }),
          );
        },
      });
    }
    if (!faceIsEmpty(card.face)) {
      steps.push({
        key: "face",
        run: async (api, id) => {
          await unwrap(
            await api.PUT("/accounts/{id}/card-face", {
              params: { path: { id } },
              body: faceBody(card.face),
            }),
          );
        },
      });
    }
  }
  if (isBrokerage && hasCash) {
    steps.push({
      key: "cash",
      run: async (api, id) => {
        const brokerage = await unwrap(
          await api.GET("/accounts/{id}", { params: { path: { id } } }),
        );
        const cash = await unwrap(
          await api.POST("/accounts", {
            body: {
              name: ids.cashName,
              class: "asset",
              kind: "brokerage",
              currency: draft.currency,
              opened_on: draft.openedOn,
              ...(brokerage.institution_id === undefined
                ? {}
                : { institution_id: brokerage.institution_id }),
              parent_id: id,
              yield_mode: "none",
            },
          }),
        );
        cashId = cash.id;
      },
    });
  }
  if (draft.opening > 0 && hasCash) {
    steps.push({
      key: "opening",
      run: async (api, id) => {
        const target = isBrokerage
          ? (cashId ?? (await cashChild(api, id)))
          : id;
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
              { id: target, currency: draft.currency },
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

async function cashChild(
  api: Client<paths>,
  parentId: string,
): Promise<string> {
  let cursor: string | undefined;
  do {
    const page = await unwrap(
      await api.GET("/accounts", {
        params: {
          query: { limit: 200, ...(cursor === undefined ? {} : { cursor }) },
        },
      }),
    );
    const child = page.items.find((a) => a.parent_id === parentId);
    if (child !== undefined) return child.id;
    cursor = page.next_cursor;
  } while (cursor !== undefined);
  throw new Error("the brokerage has no cash account");
}
