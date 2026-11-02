import { SettingsAbout } from "@/features/setup/settings-about";
import { SettingsAccount } from "@/features/setup/settings-account";
import { SettingsAppearance } from "@/features/setup/settings-appearance";
import { SettingsAssistant } from "@/features/setup/settings-assistant";
import { SettingsBackup } from "@/features/setup/settings-backup";
import { SettingsCalendars } from "@/features/setup/settings-calendars";
import { SettingsData } from "@/features/setup/settings-data";
import { SettingsExternalAccess } from "@/features/setup/settings-external-access";
import { SettingsIntegrations } from "@/features/setup/settings-integrations";
import { SettingsLedger } from "@/features/setup/settings-ledger";
import { SettingsMarketData } from "@/features/setup/settings-market-data";
import { SettingsMembers } from "@/features/setup/settings-members";
import { SettingsSecurity } from "@/features/setup/settings-security";
import type { SettingsTopic } from "@/features/setup/settings-topics";

export function SettingsPane({ topic }: { topic: SettingsTopic }) {
  switch (topic) {
    case "account":
      return <SettingsAccount />;
    case "security":
      return <SettingsSecurity />;
    case "appearance":
      return <SettingsAppearance />;
    case "finances":
      return <SettingsLedger />;
    case "calendars":
      return <SettingsCalendars />;
    case "members":
      return <SettingsMembers />;
    case "integrations":
      return <SettingsIntegrations />;
    case "market_data":
      return <SettingsMarketData />;
    case "assistant":
      return <SettingsAssistant />;
    case "external_access":
      return <SettingsExternalAccess />;
    case "data":
      return <SettingsData />;
    case "backup":
      return <SettingsBackup />;
    case "about":
      return <SettingsAbout />;
  }
}
