import {
  DescriptionList,
  DescriptionListDescription,
  DescriptionListItem,
  DescriptionListTerm,
} from "@slotted/react/description-list";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import type { YieldGroup } from "@/features/portfolio/yield-figures";
import { useAmountTone } from "@/ui/amount-tone";

interface YieldGroupListProps {
  group: YieldGroup;
}

// One group of the yield (RC6): its title and period, then one ruled list of every figure. A
// negative figure is in the danger tone.
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
                  numeric="tabular"
                  tone={amountTone("result", row.negative ? "out" : "in")}
                >
                  {row.value}
                </Text>

                {row.hint !== undefined && (
                  <Text size="sm" tone="muted">
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
