import {
  StatCard,
  StatCardComparison,
  StatCardFigure,
  StatCardHeader,
  StatCardLabel,
  StatCardMessage,
  StatCardStatus,
  StatCardValue,
} from "@slotted/react/stat-card";

import type { components } from "@/api/schema.gen";
import { StatementBadge } from "@/features/admin/statement-badge";
import { useDisplay } from "@/features/admin/use-display";
import { useT } from "@/i18n/i18n-provider";

type Statement = components["schemas"]["StatementSummary"];

// One card's statement of a reference month: the amount due, its status and its two dates.
export function StatementTile({
  label,
  month,
  statement,
  loading = false,
  size = "md",
  dates = true,
}: {
  label: string;
  month: string;
  statement: Statement | undefined;
  loading?: boolean;
  size?: "md" | "lg";
  // Off where the dates have figures of their own beside the tile.
  dates?: boolean;
}) {
  const t = useT();
  const show = useDisplay();
  return (
    <StatCard
      size={size}
      loading={loading}
      status={!loading && statement === undefined ? "empty" : "ready"}
    >
      <StatCardHeader>
        <StatCardLabel>{label}</StatCardLabel>
        {statement !== undefined && (
          <StatCardStatus>
            <StatementBadge status={statement.status} />
          </StatCardStatus>
        )}
      </StatCardHeader>
      <StatCardFigure>
        <StatCardValue
          value={
            statement === undefined
              ? undefined
              : show.money(statement.amount_due)
          }
        />
        {statement !== undefined && dates && (
          <StatCardComparison>
            {t("admin.headline.statementDates", {
              closing: show.date(statement.closing_date),
              due: show.date(statement.due_date),
            })}
          </StatCardComparison>
        )}
      </StatCardFigure>
      <StatCardMessage>
        {t("admin.headline.noStatement", { month: show.month(month) })}
      </StatCardMessage>
    </StatCard>
  );
}
