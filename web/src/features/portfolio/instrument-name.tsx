import { Inline } from "@slotted/react/inline";
import { Text } from "@slotted/react/typography";

import { AppLink } from "@/ui/app-link";

interface InstrumentNameProps {
  code: string;
  name: string;
}

// An investment reads by its name with its code beside it, and opens its page. The code repeats
// nothing when the catalog names the instrument by its code.
export function InstrumentName({ code, name }: InstrumentNameProps) {
  return (
    <Inline gap={2} align="center" wrap="nowrap">
      <AppLink
        variant="neutral"
        underline="hover"
        to={{ to: "/instruments/$code", params: { code } }}
      >
        {name}
      </AppLink>
      {name !== code && (
        <Text size="sm" tone="muted">
          {code}
        </Text>
      )}
    </Inline>
  );
}
