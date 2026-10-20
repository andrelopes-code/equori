import { Grid } from "@slotted/react/grid";
import { Stack } from "@slotted/react/stack";

import type { components } from "@/api/schema.gen";
import { FigureTile } from "@/features/admin/figure-tile";
import { StatementBreakdown } from "@/features/admin/statement-breakdown";
import { StatementTile } from "@/features/admin/statement-tile";
import { TitledSection } from "@/features/admin/titled-section";
import { useDisplay } from "@/features/admin/use-display";
import { useT } from "@/i18n/i18n-provider";

type Statement = components["schemas"]["StatementSummary"];
type Account = components["schemas"]["Account"];

// The figures to hold against the institution's own statement of the month.
export function StatementHeadline({
  card,
  month,
  statement,
  loading,
}: {
  card: Account | undefined;
  month: string;
  statement: Statement | undefined;
  loading: boolean;
}) {
  const t = useT();
  const show = useDisplay();
  const limit = card?.card?.credit_limit;
  const available = card?.card?.available_limit;
  return (
    <Stack gap={5}>
      <Grid gap={4} minItemWidth="sm">
        <StatementTile
          size="lg"
          label={t("admin.headline.statement", { month: show.month(month) })}
          month={month}
          statement={statement}
          loading={loading}
          dates={false}
        />
        <FigureTile
          size="md"
          label={t("admin.headline.closing")}
          value={statement && show.date(statement.closing_date)}
          loading={loading}
        />
        <FigureTile
          size="md"
          label={t("admin.headline.due")}
          value={statement && show.date(statement.due_date)}
          loading={loading}
        />
        <FigureTile
          size="md"
          label={t("admin.headline.unpaid")}
          value={statement && show.money(statement.unpaid)}
          loading={loading}
        />
        <FigureTile
          size="md"
          label={t("admin.headline.availableLimit")}
          value={available && show.money(available)}
          comparison={
            limit &&
            t("admin.headline.creditLimit", { limit: show.money(limit) })
          }
        />
      </Grid>
      {statement !== undefined && (
        <TitledSection title={t("admin.headline.breakdown")}>
          <StatementBreakdown statement={statement} />
        </TitledSection>
      )}
    </Stack>
  );
}
