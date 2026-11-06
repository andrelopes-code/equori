import { Button } from "@slotted/react/button";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import type { ProfileDraft } from "@/features/accounts/csv-guess";
import { useColumnSuggestion } from "@/features/accounts/use-column-suggestion";
import { useT } from "@/i18n/i18n-provider";
import { FormNotice } from "@/ui/form-notice";

interface CsvSuggestionActionProps {
  id: string;
  text: string;
  draft: ProfileDraft;
  troubled: boolean;
  onChange: (next: ProfileDraft) => void;
}

// Asks the configured language model which columns hold what, when the draft does not read the file.
export function CsvSuggestionAction(props: CsvSuggestionActionProps) {
  const t = useT();
  const suggestion = useColumnSuggestion(props);
  if (!suggestion.visible) return null;

  return (
    <Stack gap={2}>
      <div>
        <Button
          variant="outline"
          loading={suggestion.pending}
          onClick={suggestion.run}
        >
          {t("importFile.suggest")}
        </Button>
      </div>
      <Text size="sm" tone="muted">
        {t("importFile.suggestHint")}
      </Text>
      {suggestion.error !== null && <FormNotice>{suggestion.error}</FormNotice>}
    </Stack>
  );
}
