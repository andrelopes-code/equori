import { Field, FieldError, FieldLabel } from "@slotted/react/field";
import { Stack } from "@slotted/react/stack";
import { TextField } from "@slotted/react/text-field";

import { CategoryPicker } from "@/features/categories";
import { formatRate } from "@/features/instruments";
import { EntryResult } from "@/features/transactions/entry-result";
import { AccountField } from "@/features/transactions/account-field";
import type { EntryKind } from "@/features/transactions/entry-kind";
import { EntryKindPicker } from "@/features/transactions/entry-kind-picker";
import type { ExchangeDraft } from "@/features/transactions/exchange-draft";
import formStyles from "@/features/transactions/transaction-form.module.css";
import type { useExchangeEntry } from "@/features/transactions/use-exchange-entry";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { DateInput } from "@/ui/date-input";
import { MoneyInput } from "@/ui/money-input";

// Families read: field, text-field, date-picker, stat-card. The accounts and the amounts are the
// application's own controls; the destination list holds only what the base-currency rule accepts,
// so a choice never reaches the server to be refused.
export function ExchangeForm({
  draft,
  onChange,
  view,
  errors,
  scale,
  onKind,
}: {
  draft: ExchangeDraft;
  onChange: (draft: ExchangeDraft) => void;
  view: ReturnType<typeof useExchangeEntry>["view"];
  errors: Record<string, string>;
  scale: (code: string) => number;
  onKind: (kind: EntryKind) => void;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const set = (patch: Partial<ExchangeDraft>) => {
    onChange({ ...draft, ...patch });
  };
  const { base, from, to, foreignCode } = view;
  const percent = (bp: number) =>
    numberFormatter(locale, {
      style: "percent",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      signDisplay: "exceptZero",
    }).format(bp / 10000);

  return (
    <Stack gap={6}>
      <EntryKindPicker value="exchange" onChange={onKind} investments />

      <div className={formStyles.pair}>
        <Field invalid={errors.from_account_id !== undefined}>
          <FieldLabel>{t("exchange.from")}</FieldLabel>
          <AccountField
            compact
            name="from"
            title={t("exchange.from")}
            context={t("exchange.fromContext")}
            accounts={view.fromChoices}
            value={from?.id ?? null}
            exclude={null}
            amount={0}
            direction="out"
            date={draft.date}
            categoryId={null}
            payeeId={null}
            kind="transfer"
            currency={from?.currency ?? base ?? ""}
            scale={scale}
            onChange={(id) => {
              set({ fromId: id });
            }}
          />
          {errors.from_account_id !== undefined && (
            <FieldError>{errors.from_account_id}</FieldError>
          )}
        </Field>
        <Field invalid={errors.to_account_id !== undefined}>
          <FieldLabel>{t("exchange.to")}</FieldLabel>
          <AccountField
            compact
            name="to"
            title={t("exchange.to")}
            context={t("exchange.toContext", { currency: base ?? "" })}
            accounts={view.toChoices}
            value={to?.id ?? null}
            exclude={null}
            amount={0}
            direction="in"
            date={draft.date}
            categoryId={null}
            payeeId={null}
            kind="transfer"
            currency={to?.currency ?? base ?? ""}
            scale={scale}
            onChange={(id) => {
              set({ toId: id });
            }}
          />
          {errors.to_account_id !== undefined && (
            <FieldError>{errors.to_account_id}</FieldError>
          )}
        </Field>
      </div>

      <Field invalid={errors.date !== undefined}>
        <FieldLabel>{t("entry.date")}</FieldLabel>
        <DateInput
          name="date"
          value={draft.date}
          onChange={(date) => {
            set({ date });
          }}
        />
        {errors.date !== undefined && <FieldError>{errors.date}</FieldError>}
      </Field>

      <div className={formStyles.pair}>
        <Field invalid={errors.from_amount !== undefined}>
          <FieldLabel>{t("exchange.fromAmount")}</FieldLabel>
          <MoneyInput
            value={draft.fromAmount}
            currency={from?.currency ?? base ?? ""}
            scale={view.fromScale}
            sign="expense"
            onChange={(fromAmount) => {
              set({ fromAmount });
            }}
          />
          {errors.from_amount !== undefined && (
            <FieldError>{errors.from_amount}</FieldError>
          )}
        </Field>
        <Field invalid={errors.to_amount !== undefined}>
          <FieldLabel>{t("exchange.toAmount")}</FieldLabel>
          <MoneyInput
            value={draft.toAmount}
            currency={to?.currency ?? base ?? ""}
            scale={view.toScale}
            sign="income"
            onChange={(toAmount) => {
              set({ toAmount });
            }}
          />
          {errors.to_amount !== undefined && (
            <FieldError>{errors.to_amount}</FieldError>
          )}
        </Field>
      </div>

      <div className={formStyles.pair}>
        <Field invalid={errors.fee !== undefined}>
          <FieldLabel>{t("exchange.fee")}</FieldLabel>
          <MoneyInput
            value={draft.fee}
            currency={base ?? ""}
            scale={view.baseScale}
            sign="expense"
            onChange={(fee) => {
              set({ fee });
            }}
          />
          {errors.fee !== undefined && <FieldError>{errors.fee}</FieldError>}
        </Field>
        {draft.fee > 0 && (
          <Field invalid={errors.fee_category_id !== undefined}>
            <FieldLabel>{t("exchange.feeCategory")}</FieldLabel>
            <CategoryPicker
              placeholder={t("exchange.feeCategoryPlaceholder")}
              value={draft.feeCategoryId}
              amount={-1}
              onChange={(id) => {
                set({ feeCategoryId: id });
              }}
            />
            {errors.fee_category_id !== undefined && (
              <FieldError>{errors.fee_category_id}</FieldError>
            )}
          </Field>
        )}
      </div>

      <Field invalid={errors.description !== undefined}>
        <FieldLabel>{t("facts.description")}</FieldLabel>
        <TextField
          name="description"
          value={draft.description}
          maxLength={500}
          onChange={(event) => {
            set({ description: event.target.value });
          }}
        />
        {errors.description !== undefined && (
          <FieldError>{errors.description}</FieldError>
        )}
      </Field>

      <EntryResult
        label={t("exchange.result")}
        figures={[
          {
            label: t("exchange.rate"),
            value:
              view.rate === null ||
              foreignCode === undefined ||
              base === undefined
                ? undefined
                : t("exchange.rateLine", {
                    from: foreignCode,
                    rate: formatRate(view.rate, locale),
                    to: base,
                  }),
          },
          {
            label: t("exchange.rateInverse"),
            value:
              view.inverse === null ||
              foreignCode === undefined ||
              base === undefined
                ? undefined
                : t("exchange.rateLine", {
                    from: base,
                    rate: formatRate(view.inverse, locale),
                    to: foreignCode,
                  }),
          },
          {
            label: t("exchange.totalDebited"),
            value:
              view.totalDebited === null || from === undefined
                ? undefined
                : fmt.money(
                    { amount: view.totalDebited, currency: from.currency },
                    view.fromScale,
                  ),
          },
          {
            label: t("exchange.comparison"),
            value:
              view.difference === null ? undefined : percent(view.difference),
          },
        ]}
      />
    </Stack>
  );
}
