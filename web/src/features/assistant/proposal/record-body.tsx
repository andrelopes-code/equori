import type { components } from "@/api/schema.gen";
import styles from "@/features/assistant/proposal/bodies.module.css";
import { ItemRows } from "@/features/assistant/proposal/item-rows";
import {
  changeOf,
  changesWithout,
} from "@/features/assistant/proposal/preview-field";
import { ProposalChanges } from "@/features/assistant/proposal/proposal-changes";

type Preview = components["schemas"]["AssistantPreview"];

interface RecordBodyProps {
  preview: Preview;
}

// The transaction to record as one row built from its changes; the changes the row has no place
// for (category, tags, installments) stay field rows.
export function RecordBody({ preview }: RecordBodyProps) {
  const date = changeOf(preview, "date")?.after?.date;
  const amount = changeOf(preview, "amount")?.after;
  const account = changeOf(preview, "account")?.after?.text;
  const item = {
    description: changeOf(preview, "description")?.after?.text ?? "",
    ...(date !== undefined && { date }),
    ...(amount !== undefined && { amount }),
    ...(account !== undefined && { account }),
  };
  const rest = changesWithout(preview, [
    "description",
    "date",
    "amount",
    "account",
  ]);

  return (
    <div className={styles.body}>
      <ItemRows items={[item]} />

      <ProposalChanges changes={rest} />
    </div>
  );
}
