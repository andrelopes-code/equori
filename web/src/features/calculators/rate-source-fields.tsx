import { FilledNote } from "@/features/calculators/filled-note";
import { clearFloating } from "@/features/calculators/floating";
import { FloatingFields } from "@/features/calculators/floating-fields";
import { floatingOrigin } from "@/features/calculators/floating-origin";
import { IndexChoice } from "@/features/calculators/index-choice";
import { RateField } from "@/features/calculators/rate-field";
import type { RateSource } from "@/features/calculators/use-rate-source";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

// The fields of a RateSource: the choice of a fixed rate or a daily index, how the rate follows
// the index, and the rate itself, which names its origin while it comes from the index. Typing in
// the rate makes it fixed again.
export function RateSourceFields({
  label,
  hint,
  sourceLabel,
  source,
  set,
}: {
  label: string;
  // What the rate is, while the reader types it.
  hint?: string;
  sourceLabel: string;
  source: RateSource;
  set: (patch: Record<string, string | undefined>) => void;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const { keys, floatingKeys, index, fromIndex, floating } = source;
  const forget = clearFloating(floatingKeys);
  return (
    <>
      {source.daily.length > 0 && (
        <IndexChoice
          label={sourceLabel}
          hint={t("calc.rateSource.hint")}
          none={t("calc.rateSource.fixed")}
          indexes={source.daily}
          value={index?.id}
          onChange={(next) => {
            set({
              ...forget,
              ...(next === undefined
                ? { [keys.index]: undefined }
                : { [keys.index]: next, [keys.rate]: undefined }),
            });
          }}
        />
      )}
      {index !== undefined && (
        <FloatingFields
          indexId={index.id}
          floating={floating}
          keys={floatingKeys}
          percentLabel={t("calc.compound.percent")}
          set={set}
        />
      )}
      <RateField
        label={label}
        {...(hint === undefined || index !== undefined ? {} : { hint })}
        name={keys.rate}
        value={source.text}
        onChange={(v) => {
          set({ ...forget, [keys.rate]: v, [keys.index]: undefined });
        }}
        period={source.period}
        onPeriodChange={(p) => {
          set({
            ...forget,
            [keys.period]: p === "month" ? "month" : undefined,
            [keys.index]: undefined,
          });
        }}
      >
        {index !== undefined &&
          fromIndex !== null &&
          floating.value !== null && (
            <FilledNote
              origin={floatingOrigin(
                t,
                locale,
                index.id,
                { ...floating, value: floating.value },
                fromIndex.to,
              )}
            />
          )}
      </RateField>
    </>
  );
}
