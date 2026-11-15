import {
  Collapsible,
  CollapsibleHeader,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@slotted/react/collapsible";
import type { TableHandle } from "@slotted/react/table";
import type { RefObject } from "react";

import { AgendaTable } from "@/features/planning/agenda/agenda-table";
import type { AgendaRow } from "@/features/planning/model/agenda";
import { useT } from "@/i18n/i18n-provider";

interface DoneSectionProps {
  rows: readonly AgendaRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountNames: ReadonlyMap<string, string>;
  scale: (code: string) => number;
  handleRef: RefObject<TableHandle | null>;
}

// The realized and skipped occurrences of the month, closed under the open list (spec A3, P4).
export function DoneSection({
  rows,
  open,
  onOpenChange,
  accountNames,
  scale,
  handleRef,
}: DoneSectionProps) {
  const t = useT();
  if (rows.length === 0) return null;

  return (
    <Collapsible
      variant="framed"
      mount="active"
      open={open}
      onOpenChange={onOpenChange}
    >
      <CollapsibleHeader>
        <CollapsibleTrigger>
          {t("agenda.happened", { count: String(rows.length) })}
        </CollapsibleTrigger>
      </CollapsibleHeader>

      <CollapsiblePanel>
        <AgendaTable
          caption={t("agenda.doneCaption")}
          groups={[{ key: "done", rows }]}
          accountNames={accountNames}
          scale={scale}
          loading={false}
          refreshing={false}
          handleRef={handleRef}
        />
      </CollapsiblePanel>
    </Collapsible>
  );
}
