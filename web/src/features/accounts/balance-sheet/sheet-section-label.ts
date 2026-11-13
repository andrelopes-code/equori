import type { components } from "@/api/schema.gen";
import { groupLabels } from "@/features/accounts/balance-sheet/balance-groups";
import {
  noInstitution,
  type SheetSection,
} from "@/features/accounts/balance-sheet/sheet-layout";
import type { MessageKey } from "@/i18n/catalog.en";

type Institution = components["schemas"]["Institution"];

// The title of a section: the name of its group by type, of its institution, or a fixed title.
export function sectionLabel(
  section: SheetSection,
  institutions: ReadonlyMap<string, Pick<Institution, "name">>,
  t: (key: MessageKey) => string,
): string {
  if (section.group !== undefined) return t(groupLabels[section.group]);
  if (section.key === noInstitution) return t("balanceSheet.noInstitution");
  if (section.institutionId !== undefined) {
    return (
      institutions.get(section.institutionId)?.name ?? section.institutionId
    );
  }
  return t("balanceSheet.allAccounts");
}
