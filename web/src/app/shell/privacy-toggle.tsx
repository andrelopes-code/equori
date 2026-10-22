import { Icon } from "@slotted/react/icon";
import { IconButton } from "@slotted/react/button";

import { ShellIcon } from "@/app/shell/shell-icon";
import { useT } from "@/i18n/i18n-provider";
import { usePrivacy } from "@/privacy/privacy-provider";

// Families read: button. The name stays "Hide amounts" in both states; the pressed state carries it.
export function PrivacyToggle() {
  const t = useT();
  const { hidden, setHidden } = usePrivacy();
  return (
    <IconButton
      aria-label={t("privacy.hide")}
      pressed={hidden}
      onPressedChange={setHidden}
      size="lg"
    >
      <Icon>
        <ShellIcon name={hidden ? "eye-off" : "eye"} />
      </Icon>
    </IconButton>
  );
}
