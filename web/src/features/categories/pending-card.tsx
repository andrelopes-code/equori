import { Link } from "@slotted/react/link";
import { useNavigate } from "@tanstack/react-router";

import { FigureCard } from "@/ui/figure-card";
import type { CategoryClass } from "@/features/categories/category-paths";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

// OV-01: the figure leads to the list it counts, with the month and the condition in the address.
export function PendingCard({
  amount,
  share,
  cls,
  currency,
  scale,
  from,
  to,
}: {
  // Minor units in the base currency, signed as the class reads.
  amount: number;
  // 0 to 1, of the class total.
  share: number;
  cls: CategoryClass;
  currency: string;
  scale: number;
  from: string;
  to: string;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const navigate = useNavigate();
  const percent = numberFormatter(locale, {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(share);
  return (
    <FigureCard
      label={t("category.pending")}
      value={{ money: { amount, currency }, scale }}
      note={t(
        cls === "income"
          ? "category.pendingNote.income"
          : "category.pendingNote.expense",
        { share: percent },
      )}
      action={
        <Link
          href={`/transactions?uncategorized=true&from=${from}&to=${to}`}
          onClick={(event) => {
            event.preventDefault();
            void navigate({
              to: "/transactions",
              search: { uncategorized: true, from, to },
            });
          }}
        >
          {t("coverage.review")}
        </Link>
      }
    />
  );
}
