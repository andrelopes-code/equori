import {
  DescriptionList,
  DescriptionListDescription,
  DescriptionListItem,
  DescriptionListTerm,
} from "@slotted/react/description-list";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import type { YieldGroup } from "@/features/portfolio/model/yield-figures";
import { useAmountTone } from "@/ui/money/amount-tone";

interface YieldGroupListProps {
  group: YieldGroup;
}

// One group of the yield (RC6): its title and period, then one ruled list of every figure. A
// negative figure is in the danger tone. The values end the row: a list sizes its term column to
// its widest term, so a value written at the start sits against that term and the value columns
// of two groups stagger.
export function YieldGroupList({ group }: YieldGroupListProps) {
  const amountTone = useAmountTone();

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

      <DescriptionList variant="ruled">
        {group.rows.map((row) => (
          <DescriptionListItem key={row.key}>
            <DescriptionListTerm>{row.term}</DescriptionListTerm>
            <DescriptionListDescription>
              <Stack gap={0}>
                <Text
                  size="sm"
                  align="end"
                  numeric="tabular"
                  tone={amountTone("result", row.negative ? "out" : "in")}
                >
                  {row.value}
                </Text>

                {row.hint !== undefined && (
                  <Text size="sm" tone="muted" align="end">
                    {row.hint}
                  </Text>
                )}
              </Stack>
            </DescriptionListDescription>
          </DescriptionListItem>
        ))}
      </DescriptionList>
    </Stack>
  );
}
