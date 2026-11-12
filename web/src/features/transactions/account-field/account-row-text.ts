import type { AccountChoice } from "@/features/transactions/account-field/use-account-choices";
import { formatDayMonthNumeric } from "@/i18n/format";
import type { MessageKey } from "@/i18n/catalog.en";
import type { TFunction } from "@/i18n/i18n-provider";

export type RowTone = "accent" | "danger" | "warning";

// The words of one row. The fact has a long form and a short form (R8); a risk replaces the
// label of the figure (R9).
export interface RowText {
  fact: { long: string; short: string; tone: RowTone | undefined } | null;
  figure: string | null;
  label: { text: string; tone: RowTone | undefined } | null;
}

export interface RowTextContext {
  t: TFunction;
  locale: string;
  // The amount in the account's currency, written through useMoneyFormat (O9).
  money: (amount: number) => string;
}

export function rowTextOf(choice: AccountChoice, ctx: RowTextContext): RowText {
  if (choice.group === "cards") return cardText(choice, ctx);

  const { account, balance, consequence } = choice;
  const figure =
    balance !== undefined && account.class === "asset"
      ? ctx.money(balance)
      : null;
  if (figure === null)
    return { fact: kindFact(choice, ctx), figure, label: null };

  const { t } = ctx;
  const label =
    consequence?.kind === "overdraw"
      ? {
          text: t("accountChoice.fact.overdraw", {
            amount: ctx.money(consequence.after),
          }),
          tone: "danger" as const,
        }
      : consequence?.kind === "reserve"
        ? { text: t("accountChoice.fact.reserve"), tone: "warning" as const }
        : { text: t("accountChoice.label.balance"), tone: undefined };
  return { fact: kindFact(choice, ctx), figure, label };
}

function cardText(choice: AccountChoice, ctx: RowTextContext): RowText {
  const { t, locale } = ctx;
  const { consequence, unavailable, freeLimit } = choice;
  const figure = freeLimit === undefined ? null : ctx.money(freeLimit);
  const label =
    figure === null
      ? null
      : { text: t("accountChoice.label.freeLimit"), tone: undefined };

  if (unavailable !== null) {
    const text = t("accountChoice.fact.noLimit", {
      amount: ctx.money(unavailable.missing),
    });
    return { fact: { long: text, short: text, tone: "danger" }, figure, label };
  }
  if (consequence?.kind === "statement") {
    const date = formatDayMonthNumeric(consequence.dueDate, locale);
    const short = t("accountChoice.fact.statement", { date });
    const closed = consequence.closedOn;
    const long =
      closed === null
        ? short
        : t("accountChoice.fact.statementClosed", {
            date,
            day: Number(closed.slice(8, 10)),
          });
    const tone = closed === null ? undefined : "accent";
    return { fact: { long, short, tone }, figure, label };
  }
  if (consequence?.kind === "settles") {
    const date = formatDayMonthNumeric(consequence.dueDate, locale);
    const text = t("accountChoice.fact.settles", { date });
    return { fact: { long: text, short: text, tone: "accent" }, figure, label };
  }
  return { fact: kindFact(choice, ctx), figure, label };
}

// "Conta corrente": the kind, capitalised by the locale; an account without a kind has no fact.
function kindFact(choice: AccountChoice, ctx: RowTextContext) {
  const { kind } = choice.account;
  if (kind === undefined) return null;

  const word = ctx.t(`kind.${kind}` as MessageKey);
  const text = word.charAt(0).toLocaleUpperCase(ctx.locale) + word.slice(1);
  return { long: text, short: text, tone: undefined };
}
