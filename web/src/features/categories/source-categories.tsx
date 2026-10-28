import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableColumnHeader,
  TableContent,
  TableHead,
  TableRow,
} from "@slotted/react/table";

import type { components } from "@/api/schema.gen";
import { CategoryPicker } from "@/features/categories/category-picker";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type SourceCategory = components["schemas"]["SourceCategory"];

// A41: the categories a bank sent with imported lines, each mapped to one of the owner's.
export function SourceCategories({
  items,
  onMap,
}: {
  items: readonly SourceCategory[];
  onMap: (id: string, categoryId: string | null) => void;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const count = numberFormatter(locale);
  return (
    <Table columns={3} variant="framed">
      <TableContent>
        <TableCaption>{t("sources.caption")}</TableCaption>
        <TableHead>
          <TableRow>
            <TableColumnHeader>{t("sources.bank")}</TableColumnHeader>
            <TableColumnHeader numeric>{t("sources.lines")}</TableColumnHeader>
            <TableColumnHeader>{t("sources.category")}</TableColumnHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{item.name}</TableCell>
              <TableCell numeric>{count.format(item.count)}</TableCell>
              <TableCell>
                <CategoryPicker
                  aria-label={t("sources.mapNamed", { name: item.name })}
                  placeholder={t("sources.unmapped")}
                  size="sm"
                  variant="plain"
                  value={item.category_id ?? null}
                  onChange={(id) => {
                    onMap(item.id, id);
                  }}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </TableContent>
    </Table>
  );
}
