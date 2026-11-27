import { Button } from "@slotted/react/button";
import {
  Section,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { OpeningLossRow } from "@/features/portfolio/gain-tax/opening-loss-row";
import { useOpeningLosses } from "@/features/portfolio/gain-tax/use-opening-losses";
import { settingsQuery } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { QueryError } from "@/ui/feedback/query-error";

// WB4, LO4: the loss of each pool of the monthly tax carried from before the recorded history.
// A region without a pool draws nothing.
export function OpeningLossesSection() {
  const t = useT();
  const api = useApi();
  const currency = useQuery(settingsQuery(api)).data?.base_currency;
  const { rows, change, submit, saving, error } = useOpeningLosses();

  if (rows.length === 0 || currency === undefined) return null;

  return (
    <Section>
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("gainTax.openingLosses")}</SectionHeading>
        </SectionTitle>
        <SectionDescription>
          {t("gainTax.openingLosses.description")}
        </SectionDescription>
      </SectionHeader>

      <SectionBody>
        {rows.map((row) => (
          <OpeningLossRow
            key={row.pool}
            row={row}
            currency={currency}
            onChange={(patch) => {
              change(row.pool, patch);
            }}
          />
        ))}

        {error !== null && <QueryError error={error} onRetry={submit} />}

        <Button loading={saving} onClick={submit}>
          {t("gainTax.openingLosses.save")}
        </Button>
      </SectionBody>
    </Section>
  );
}
