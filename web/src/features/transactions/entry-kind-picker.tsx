import { Button } from "@slotted/react/button";
import {
  FieldGroup,
  FieldGroupContent,
  FieldGroupLegend,
} from "@slotted/react/field-group";
import { Glyph } from "@slotted/react/icon";
import { Inline } from "@slotted/react/inline";
import {
  Menu,
  MenuContent,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
} from "@slotted/react/menu";
import { Segment, SegmentedControl } from "@slotted/react/segmented-control";

import { isBuiltKind } from "@/features/transactions/entry-kind";
import type { EntryKind } from "@/features/transactions/entry-kind";
import type { MessageKey } from "@/i18n/catalog.en";
import { useT } from "@/i18n/i18n-provider";

const kinds: {
  value: EntryKind;
  label: MessageKey;
  hint: MessageKey;
}[] = [
  {
    value: "expense",
    label: "entry.kind.expense",
    hint: "entry.kindHint.expense",
  },
  {
    value: "income",
    label: "entry.kind.income",
    hint: "entry.kindHint.income",
  },
  {
    value: "transfer",
    label: "entry.kind.transfer",
    hint: "entry.kindHint.transfer",
  },
  { value: "trade", label: "entry.kind.trade", hint: "entry.kindHint.trade" },
  {
    value: "investment_income",
    label: "entry.kind.investment_income",
    hint: "entry.kindHint.investment_income",
  },
  {
    value: "foreign_purchase",
    label: "entry.kind.foreign_purchase",
    hint: "entry.kindHint.foreign_purchase",
  },
  {
    value: "exchange",
    label: "entry.kind.exchange",
    hint: "entry.kindHint.exchange",
  },
  {
    value: "advanced",
    label: "entry.kind.advanced",
    hint: "entry.kindHint.advanced",
  },
];

// The three kinds most entries are.
const frequent: readonly EntryKind[] = ["expense", "income", "transfer"];

interface EntryKindPickerProps {
  value: EntryKind;
  onChange: (kind: EntryKind) => void;
  // Only the new-entry flow records a kind the server builds; a correction keeps its postings.
  investments?: boolean;
}

// docs/contributing/forms.md, F13: the three frequent kinds are segments read at a glance; the
// others, each needing a sentence, sit in a menu beside them that names the one chosen. A lone
// other kind (a correction offers only the advanced one) is a fourth segment.
export function EntryKindPicker({
  value,
  onChange,
  investments = false,
}: EntryKindPickerProps) {
  const t = useT();

  const shown = kinds.filter((kind) => investments || !isBuiltKind(kind.value));
  const others = shown.filter((kind) => !frequent.includes(kind.value));
  const segments =
    others.length === 1
      ? shown
      : shown.filter((kind) => frequent.includes(kind.value));
  const menu = others.length > 1 ? others : [];
  const chosenOther = menu.find((kind) => kind.value === value);

  function handleChange(next: string) {
    const kind = shown.find((k) => k.value === next);
    if (kind !== undefined) onChange(kind.value);
  }

  return (
    <FieldGroup>
      <FieldGroupLegend>{t("entry.kind")}</FieldGroupLegend>
      <FieldGroupContent>
        <Inline gap={4} wrap="wrap" align="center">
          <SegmentedControl
            aria-label={t("entry.kind")}
            value={chosenOther === undefined ? value : ""}
            onValueChange={handleChange}
          >
            {segments.map((kind) => (
              <Segment key={kind.value} value={kind.value}>
                {t(kind.label)}
              </Segment>
            ))}
          </SegmentedControl>

          {menu.length > 0 && (
            <Menu>
              <MenuTrigger
                render={(props) => (
                  <Button
                    {...props}
                    variant="outline"
                    tone={chosenOther === undefined ? "secondary" : "accent"}
                    end={<Glyph name="chevron-down" />}
                  >
                    {t(chosenOther?.label ?? "entry.otherKinds")}
                  </Button>
                )}
              />
              <MenuContent>
                <MenuRadioGroup
                  aria-label={t("entry.otherKinds")}
                  value={chosenOther?.value ?? ""}
                  onValueChange={handleChange}
                >
                  {menu.map((kind) => (
                    <MenuRadioItem
                      key={kind.value}
                      value={kind.value}
                      description={t(kind.hint)}
                      // Workaround for Slotted issue #25: an item with a description takes it
                      // into its accessible name; the label alone names the kind.
                      aria-label={t(kind.label)}
                    >
                      {t(kind.label)}
                    </MenuRadioItem>
                  ))}
                </MenuRadioGroup>
              </MenuContent>
            </Menu>
          )}
        </Inline>
      </FieldGroupContent>
    </FieldGroup>
  );
}
