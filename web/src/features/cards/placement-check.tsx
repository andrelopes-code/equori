import { Field, FieldDescription, FieldLabel } from "@slotted/react/field";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { ProblemError, errorText } from "@/api/problem";
import { placementQuery } from "@/features/cards/api";
import { formatDate, formatMonthTitle } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { DateInput } from "@/ui/date-input";

// Where a purchase on a day is billed, with the dates the rule's calendar gives; nothing is stored.
export function PlacementCheck({ accountId }: { accountId: string }) {
  const t = useT();
  const [locale] = useAppLocale();
  const today = useToday();
  const [date, setDate] = useState(today);
  const placement = useQuery(placementQuery(useApi(), accountId, date));
  return (
    <Field necessity="none">
      <FieldLabel>{t("card.purchaseOn")}</FieldLabel>
      <DateInput name="date" value={date} onChange={setDate} />
      <FieldDescription live="polite">
        {placement.data !== undefined
          ? t("card.placement", {
              month: formatMonthTitle(placement.data.reference, locale),
              closing: formatDate(placement.data.closing_date, locale),
              due: formatDate(placement.data.due_date, locale),
            })
          : placement.error instanceof ProblemError &&
              placement.error.status === 422
            ? t("card.placementNoRule")
            : placement.isError
              ? errorText(placement.error, t)
              : ""}
      </FieldDescription>
    </Field>
  );
}
