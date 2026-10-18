import { parseISODate, toISODate } from "@slotted/core/date";
import { DatePicker } from "@slotted/react/date-picker";
import { Field, FieldLabel } from "@slotted/react/field";
import {
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverHeader,
  PopoverLayer,
  PopoverTitle,
  PopoverTrigger,
} from "@slotted/react/popover";

import { FilterWord } from "@/features/transactions/filter-word";
import styles from "@/features/transactions/transaction-filter-bar.module.css";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

export interface Period {
  from: string | undefined;
  to: string | undefined;
}

// Slotted families read: popover, date-picker and filter-bar. popover draws the panel and
// date-picker the two dates; filter-bar has no trigger without its dashed pill, so the
// trigger word and the clear action are the application's own.
export function FilterPeriod({
  period,
  onChange,
}: {
  period: Period;
  onChange: (period: Period) => void;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const name = t("transactions.filter.period");
  const { from, to } = period;
  const value =
    from !== undefined && to !== undefined
      ? `${formatDate(from, locale)} – ${formatDate(to, locale)}`
      : from !== undefined
        ? `${t("transactions.filter.onOrAfter")} ${formatDate(from, locale)}`
        : to !== undefined
          ? `${t("transactions.filter.onOrBefore")} ${formatDate(to, locale)}`
          : undefined;
  const dateField = (
    label: string,
    current: string | undefined,
    set: (date: string | undefined) => void,
  ) => (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <DatePicker
        value={parseISODate(current ?? "")}
        onValueChange={(next) => {
          set(next !== null && "year" in next ? toISODate(next) : undefined);
        }}
      />
    </Field>
  );
  return (
    <FilterWord
      name={name}
      value={value}
      onRemove={() => {
        onChange({ from: undefined, to: undefined });
      }}
      trigger={(word) => (
        <Popover arrow={false} align="start">
          <PopoverTrigger
            render={(props) => <button type="button" {...props} {...word} />}
          />
          <PopoverLayer>
            <PopoverContent>
              <PopoverHeader>
                <PopoverTitle>{name}</PopoverTitle>
              </PopoverHeader>
              <PopoverBody>
                <div className={styles.period}>
                  {dateField(
                    t("transactions.filter.periodFrom"),
                    from,
                    (date) => {
                      onChange({ from: date, to });
                    },
                  )}
                  {dateField(t("transactions.filter.periodTo"), to, (date) => {
                    onChange({ from, to: date });
                  })}
                  <button
                    type="button"
                    className={styles.periodClear}
                    onClick={() => {
                      onChange({ from: undefined, to: undefined });
                    }}
                  >
                    {t("transactions.filter.clear")}
                  </button>
                </div>
              </PopoverBody>
            </PopoverContent>
          </PopoverLayer>
        </Popover>
      )}
    />
  );
}
