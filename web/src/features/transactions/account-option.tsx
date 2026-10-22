import { Badge } from "@slotted/react/badge";
import { Radio } from "@slotted/react/radio-group";
import { AccountMark } from "@/features/accounts";
import { AccountDetail } from "@/features/transactions/account-detail";
import styles from "@/features/transactions/account-option.module.css";
import type { AccountChoice } from "@/features/transactions/use-account-choices";
import type { SuggestionView } from "@/features/transactions/use-account-choices";
import { formatDayMonthNumeric } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { MoneyFigure } from "@/ui/money-figure";

// One account of the picker, a radio of the radio-group family drawn as a tile: the family
// keeps the input, the arrow keys, the checked and disabled states and the focus ring; the
// label lays out the mark, the account and what choosing it does in one compact row.
export function AccountOption({
  choice,
  suggestion,
  scale,
}: {
  choice: AccountChoice;
  suggestion: SuggestionView | null;
  scale: number;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const { account, consequence, unavailable } = choice;
  const money = (amount: number) => (
    <MoneyFigure amount={amount} currency={account.currency} scale={scale} />
  );
  const suggested = suggestion?.accountId === account.id;

  const warning =
    unavailable !== null ||
    (consequence?.kind === "balance" && consequence.warning);
  // The figure on the right: a small label over the value it qualifies.
  const figure =
    unavailable !== null
      ? { label: null, value: t("accountChoice.figure.noFreeLimit") }
      : consequence === null
        ? null
        : consequence.kind === "statement"
          ? {
              label: t("accountChoice.figure.statement"),
              value: formatDayMonthNumeric(consequence.dueDate, locale),
            }
          : {
              label: t(
                consequence.kind === "balance"
                  ? "accountChoice.figure.after"
                  : "accountChoice.figure.limit",
              ),
              value: money(consequence.after),
            };

  // Why the account is suggested, then the caveat of choosing it; the caveat is a warning.
  const reason = suggested
    ? t("accountChoice.suggestedReason", {
        count: suggestion.count,
        total: suggestion.total,
        name: suggestion.name,
      })
    : null;
  const caveat =
    consequence?.kind === "statement" && consequence.closedOn !== null
      ? t("accountChoice.note.closed", {
          day: Number(consequence.closedOn.slice(8, 10)),
        })
      : null;

  return (
    <Radio value={account.id} disabled={unavailable !== null}>
      <span className={styles.option}>
        <AccountMark
          shape={choice.shape}
          name={choice.institution ?? account.name}
          color={account.color}
          logo={choice.logo}
          progress={choice.progress}
          size="md"
          disabled={unavailable !== null}
        />
        <span className={styles.text}>
          <span className={styles.title}>
            <span className={styles.name}>{account.name}</span>
            {suggested && (
              <span className={styles.tag}>
                <Badge size="sm" tone="accent">
                  {t("accountChoice.suggested")}
                </Badge>
              </span>
            )}
          </span>
          <span className={styles.detail}>
            <AccountDetail choice={choice} scale={scale} />
          </span>
          {reason !== null && <span className={styles.note}>{reason}</span>}
          {caveat !== null && (
            <span className={styles.note} data-warning={warning || undefined}>
              {caveat}
            </span>
          )}
        </span>
        {figure !== null && (
          <span className={styles.figure} data-warning={warning || undefined}>
            {figure.label !== null && (
              <span className={styles.label}>{figure.label}</span>
            )}
            <span className={styles.value}>{figure.value}</span>
          </span>
        )}
      </span>
    </Radio>
  );
}
