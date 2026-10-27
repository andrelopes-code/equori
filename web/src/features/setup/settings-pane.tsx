import { SettingsAccount } from "@/features/setup/settings-account";
import { SettingsAppearance } from "@/features/setup/settings-appearance";
import { SettingsAssistant } from "@/features/setup/settings-assistant";
import { SettingsCalendars } from "@/features/setup/settings-calendars";
import { SettingsData } from "@/features/setup/settings-data";
import { SettingsExternalAccess } from "@/features/setup/settings-external-access";
import { SettingsIntegrations } from "@/features/setup/settings-integrations";
import { SettingsLanguage } from "@/features/setup/settings-language";
import { SettingsLedger } from "@/features/setup/settings-ledger";
import { SettingsPrivacy } from "@/features/setup/settings-privacy";
import type { SettingsTopic } from "@/features/setup/settings-topics";

export function SettingsPane({ topic }: { topic: SettingsTopic }) {
  switch (topic) {
    case "account":
      return <SettingsAccount />;
    case "appearance":
      return <SettingsAppearance />;
    case "language":
      return <SettingsLanguage />;
    case "privacy":
      return <SettingsPrivacy />;
    case "finances":
      return <SettingsLedger />;
    case "calendars":
      return <SettingsCalendars />;
    case "integrations":
      return <SettingsIntegrations />;
    case "assistant":
      return <SettingsAssistant />;
    case "external_access":
      return <SettingsExternalAccess />;
    case "data":
      return <SettingsData />;
  }
}
