import { Field } from "@slotted/react/field";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { statementPlacementQuery } from "@/features/transactions/api";
import {
  offerHolds,
  statementOffer,
  statementToSend,
} from "@/features/transactions/statement-offer";
import { formatMonthTitle } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/choice-select";
import { FieldTitle } from "@/ui/field-title";

export interface StatementChoiceProps {
  cardId: string;
  date: string;
  // The statement the owner chose; null leaves it to the date.
  value: string | null;
  onChange: (statement: string | null) => void;
}

// A136: a card purchase close to the closing date may be billed on the next statement; the
// owner who knows it chooses that one.
export function StatementChoice({
  cardId,
  date,
  value,
  onChange,
}: StatementChoiceProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const api = useApi();
  const placement = useQuery(statementPlacementQuery(api, cardId, date));

  const offer = statementOffer(date, placement.data);
  if (offer === null || !offerHolds(value, offer)) return null;

  return (
    <Field>
      <FieldTitle
        label={t("entry.statement")}
        help={t("entry.statementHelp")}
      />
      <ChoiceSelect
        label={t("entry.statement")}
        multiple={false}
        choices={[offer.current, offer.next].map((reference) => ({
          value: reference,
          label: formatMonthTitle(reference, locale),
        }))}
        value={value ?? offer.current}
        onChange={(chosen) => {
          if (typeof chosen === "string")
            onChange(statementToSend(chosen, value, offer));
        }}
      />
    </Field>
  );
}
