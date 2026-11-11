import { Inline } from "@slotted/react/inline";
import { Tag } from "@slotted/react/tag";
import {
  Table,
  TableBody,
  TableCell,
  TableColumnHeader,
  TableContent,
  TableHead,
  TableRow,
  TableRowHeader,
} from "@slotted/react/table";

import type { components } from "@/api/schema.gen";
import { sourceLabel } from "@/features/instruments/instrument-labels";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type Source = components["schemas"]["InstrumentSourceCoverage"];

// IP11: every registered source that quotes the instrument, enabled or not, with the dates it holds.
export function SourcesTable({ sources }: { sources: readonly Source[] }) {
  const t = useT();
  const [locale] = useAppLocale();
  const date = (iso: string | null) =>
    iso === null ? "—" : formatDate(iso, locale);

  return (
    <Table columns={4} variant="framed">
      <TableContent aria-label={t("instrument.sources.caption")}>
        <TableHead>
          <TableRow>
            <TableColumnHeader>
              {t("instrument.sources.source")}
            </TableColumnHeader>
            <TableColumnHeader>
              {t("instrument.sources.state")}
            </TableColumnHeader>
            <TableColumnHeader numeric>
              {t("instrument.sources.first")}
            </TableColumnHeader>
            <TableColumnHeader numeric>
              {t("instrument.sources.last")}
            </TableColumnHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {sources.map((s) => (
            <TableRow key={s.id} value={s.id}>
              <TableRowHeader>{sourceLabel(t, s.id)}</TableRowHeader>
              <TableCell>
                <Inline gap={4} align="center" wrap="wrap">
                  <Tag size="sm" tone={s.enabled ? "success" : "secondary"}>
                    {t(
                      s.enabled
                        ? "instrument.sources.enabled"
                        : "instrument.sources.disabled",
                    )}
                  </Tag>
                  {s.official && (
                    <Tag size="sm" variant="outline">
                      {t("instrument.sources.official")}
                    </Tag>
                  )}
                </Inline>
              </TableCell>
              <TableCell numeric>{date(s.first)}</TableCell>
              <TableCell numeric>{date(s.last)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </TableContent>
    </Table>
  );
}
