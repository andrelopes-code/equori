import { parseISODate, toISODate } from "@slotted/core/date";
import { DatePicker } from "@slotted/react/date-picker";
import { Switch } from "@slotted/react/switch";

import { SheetBarPhone } from "@/features/accounts/sheet-bar/sheet-bar-phone";
import type { SheetBarProps } from "@/features/accounts/sheet-bar/sheet-bar-props";
import { SheetBarWide } from "@/features/accounts/sheet-bar/sheet-bar-wide";
import { useT } from "@/i18n/i18n-provider";
import { compactQuery, useMediaQuery } from "@/ui/runtime/use-media-query";

// The view the sheet is read in. From 600 px every control stands in the bar; below it the bar
// keeps the date and one button that opens the rest in a sheet.
export function SheetBar(props: SheetBarProps) {
  const t = useT();
  const compact = useMediaQuery(compactQuery);

  const date = (
    <DatePicker
      aria-label={t("balanceSheet.date")}
      value={parseISODate(props.date)}
      onValueChange={(value) => {
        if (value !== null && !Array.isArray(value) && "year" in value) {
          props.onDateChange(toISODate(value));
        }
      }}
    />
  );
  const closed = (
    <Switch checked={props.closed} onCheckedChange={props.onClosedChange}>
      {t("balanceSheet.showClosed")}
    </Switch>
  );

  if (compact) {
    return (
      <SheetBarPhone
        {...props}
        date={date}
        closed={closed}
        showsClosed={props.closed}
      />
    );
  }

  return <SheetBarWide {...props} date={date} closed={closed} />;
}
