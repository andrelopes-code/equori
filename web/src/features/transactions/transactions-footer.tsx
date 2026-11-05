import { PageFooter } from "@slotted/react/page";

import type { CategoryEntry } from "@/features/categories";
import { BulkVoidDialog } from "@/features/transactions/bulk-void-dialog";
import { SelectionBar } from "@/features/transactions/selection-bar";
import { SuggestCategoriesDialog } from "@/features/transactions/suggest-categories-dialog";
import type { SelectionCommands } from "@/features/transactions/use-selection-commands";

interface TransactionsFooterProps {
  commands: SelectionCommands;
  categoriesById: Map<string, CategoryEntry>;
  suggestable: boolean;
}

export function TransactionsFooter({
  commands,
  categoriesById,
  suggestable,
}: TransactionsFooterProps) {
  return (
    <PageFooter>
      <SelectionBar
        count={commands.selection.length}
        amount={commands.selectedAmount}
        busy={commands.bulkBusy}
        open={commands.picking}
        onOpenChange={commands.setPicking}
        onClear={() => {
          commands.setSelection([]);
        }}
        onVoid={() => {
          commands.setVoiding(true);
        }}
        onCategorize={(id) => {
          void commands.categorizeSelection(id);
        }}
        {...(suggestable && {
          onSuggest: () => {
            commands.setSuggesting(true);
          },
        })}
      />

      <BulkVoidDialog
        ids={commands.selectedIds}
        {...(commands.selectedMoney !== undefined && {
          amount: commands.selectedMoney,
        })}
        open={commands.voiding}
        onOpenChange={commands.setVoiding}
        onDone={commands.finishVoid}
      />

      {commands.suggesting && (
        <SuggestCategoriesDialog
          transactions={commands.selectedRows.map((row) => row.transaction)}
          categoriesById={categoriesById}
          onOpenChange={commands.setSuggesting}
          onRecord={(accepted) => {
            void commands.recordSuggestions(accepted);
          }}
        />
      )}
    </PageFooter>
  );
}
