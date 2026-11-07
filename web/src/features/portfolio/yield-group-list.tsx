import {
  DescriptionList,
  DescriptionListDescription,
  DescriptionListItem,
  DescriptionListTerm,
} from "@slotted/react/description-list";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import type { YieldGroup } from "@/features/portfolio/yield-figures";
import { FigureCard } from "@/ui/figure-card";
import { FigureGrid } from "@/ui/figure-grid";

interface YieldGroupListProps {
  group: YieldGroup;
}

// One group of the yield section: its title and period, the figures it exists for as cards, then
// a ruled list of the figures they come from. A negative figure is in the danger tone.
export function YieldGroupList({ group }: YieldGroupListProps) {
  const key = group.rows.filter((row) => row.emphasis);
  const support = group.rows.filter((row) => !row.emphasis);

  return (
    <Stack gap={3} role="group" aria-label={group.title}>
      <Stack gap={0}>
        <Text size="sm" weight="semibold">
          {group.title}
        </Text>
        <Text size="xs" tone="muted">
          {group.period}
        </Text>
      </Stack>

      <FigureGrid label={group.title}>
        {key.map((row) => (
          <FigureCard
            key={row.key}
            label={row.term}
            value={row.value}
            note={row.hint ?? ""}
            goodWhen="none"
            attention={row.negative ? "danger" : undefined}
          />
        ))}
      </FigureGrid>

      {support.length > 0 && (
        <DescriptionList variant="ruled">
          {support.map((row) => (
            <DescriptionListItem key={row.key}>
              <DescriptionListTerm>{row.term}</DescriptionListTerm>
              <DescriptionListDescription>
                <Text
                  size="sm"
                  numeric="tabular"
                  tone={row.negative ? "danger" : "default"}
                >
                  {row.value}
                </Text>
              </DescriptionListDescription>
            </DescriptionListItem>
          ))}
        </DescriptionList>
      )}
    </Stack>
  );
}
