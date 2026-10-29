import { Stack } from "@slotted/react/stack";

import { CaptureComposer } from "@/features/transactions/capture-composer";
import { CaptureDefaultAccountField } from "@/features/transactions/capture-default-account-field";
import styles from "@/features/transactions/capture-page.module.css";
import type { CaptureSetup } from "@/features/transactions/capture-setup";
import { useMediaQuery, wideQuery } from "@/ui/use-media-query";

interface CaptureWriterProps {
  setup: CaptureSetup | null;
  defaultAccount: string | null;
  date: string;
  text: string;
  busy: boolean;
  onDefaultAccountChange: (id: string) => void;
  onTextChange: (value: string) => void;
  onRecord: () => void;
}

// The column the owner writes in: the default account and the text.
export function CaptureWriter({
  setup,
  defaultAccount,
  date,
  text,
  busy,
  onDefaultAccountChange,
  onTextChange,
  onRecord,
}: CaptureWriterProps) {
  const wide = useMediaQuery(wideQuery);

  return (
    <div className={styles.writer}>
      <Stack gap={6}>
        <CaptureDefaultAccountField
          setup={setup}
          value={defaultAccount}
          date={date}
          onChange={onDefaultAccountChange}
        />

        <Stack gap={2}>
          <CaptureComposer
            value={text}
            busy={busy}
            // A phone would open its keyboard over the page before the reader chose to type.
            autoFocus={wide}
            onChange={onTextChange}
            onRecord={onRecord}
          />
        </Stack>
      </Stack>
    </div>
  );
}
