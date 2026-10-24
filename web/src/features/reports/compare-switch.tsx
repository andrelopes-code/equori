import { Switch } from "@slotted/react/switch";

import { useT } from "@/i18n/i18n-provider";

export function CompareSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const t = useT();
  return (
    <Switch checked={checked} onCheckedChange={onChange}>
      {t("report.compare")}
    </Switch>
  );
}
