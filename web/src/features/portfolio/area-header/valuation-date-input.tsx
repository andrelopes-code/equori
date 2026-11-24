import { useT } from "@/i18n/i18n-provider";
import { DateInput } from "@/ui/form-fields/date-input";

interface ValuationDateInputProps {
  date: string;
  today: string;
  onChange: (next: string | undefined) => void;
}

// CP-04: the valuation date is a day, so it is the app's date input; its shortcuts stay out
// because a valuation reads any past day, not today and the two before.
export function ValuationDateInput({
  date,
  today,
  onChange,
}: ValuationDateInputProps) {
  const t = useT();

  return (
    <DateInput
      name="date"
      value={date}
      shortcuts={false}
      messages={{
        choose: t("portfolio.date"),
        change: ({ date: day }) => t("portfolio.dateChange", { date: day }),
      }}
      onChange={(next) => {
        onChange(next === today ? undefined : next);
      }}
    />
  );
}
