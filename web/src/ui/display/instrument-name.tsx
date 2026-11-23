import { Inline } from "@slotted/react/inline";
import { Text } from "@slotted/react/typography";

import styles from "@/ui/display/instrument-name.module.css";
import { AppLink } from "@/ui/navigation/app-link";

interface InstrumentNameProps {
  code: string;
  name: string;
}

// An investment reads by its name with its code beside it, and opens its page. The code repeats
// nothing when the catalog names the instrument by its code. A long name keeps one line and ends in
// an ellipsis, the whole name in its title; the code never shrinks.
export function InstrumentName({ code, name }: InstrumentNameProps) {
  return (
    <Inline gap={2} wrap="nowrap">
      <Text size="sm" truncate title={name} className={styles.name}>
        <AppLink
          variant="neutral"
          underline="hover"
          to={{ to: "/instruments/$code", params: { code } }}
        >
          {name}
        </AppLink>
      </Text>
      {name !== code && (
        <Text size="sm" tone="muted" className={styles.code}>
          {code}
        </Text>
      )}
    </Inline>
  );
}
