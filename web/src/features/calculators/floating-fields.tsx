import { ChoiceField } from "@/features/calculators/choice-field";
import type { Floating, FloatingKeys } from "@/features/calculators/floating";
import { dailySpread, quotedForm } from "@/features/calculators/index-catalog";
import { RateField } from "@/features/calculators/rate-field";
import { useT } from "@/i18n/i18n-provider";

// How a rate follows the chosen daily index: the form, then the percent of the index or the
// spread over it, then the basis of the index's rate. Switching the form clears both values, so a
// value never reads in the other form.
export function FloatingFields({
  indexId,
  floating,
  keys,
  percentLabel,
  set,
}: {
  indexId: string;
  floating: Floating;
  keys: FloatingKeys;
  percentLabel: string;
  set: (patch: Record<string, string | undefined>) => void;
}) {
  const t = useT();
  return (
    <>
      <ChoiceField
        label={t("calc.floating.form")}
        choices={[
          { value: "percent", label: t("calc.floating.percent") },
          { value: "spread", label: t("calc.floating.spread") },
        ]}
        value={floating.form}
        onChange={(next) => {
          set({
            [keys.form]: next === quotedForm(indexId) ? undefined : next,
            [keys.percent]: undefined,
            [keys.spread]: undefined,
          });
        }}
      />
      {floating.form === "percent" ? (
        <RateField
          label={percentLabel}
          hint={t("calc.percent.hint")}
          name={keys.percent}
          value={floating.text}
          onChange={(v) => {
            set({ [keys.form]: undefined, [keys.percent]: v });
          }}
        />
      ) : (
        <RateField
          label={t("calc.floating.spreadRate")}
          hint={t(
            dailySpread(indexId)
              ? "calc.floating.spread.daily"
              : "calc.floating.spread.compound",
          )}
          name={keys.spread}
          value={floating.text}
          onChange={(v) => {
            set({ [keys.form]: undefined, [keys.spread]: v });
          }}
        />
      )}
      <ChoiceField
        label={t("calc.floating.basis")}
        choices={[
          { value: "current", label: t("calc.floating.basis.current") },
          { value: "trailing", label: t("calc.floating.basis.trailing") },
        ]}
        value={floating.basis}
        onChange={(next) => {
          set({ [keys.basis]: next === "trailing" ? next : undefined });
        }}
      />
    </>
  );
}
