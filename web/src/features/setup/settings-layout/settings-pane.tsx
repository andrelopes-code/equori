import { SettingsAbout } from "@/features/setup/about/settings-about";
import { SettingsAccount } from "@/features/setup/account/settings-account";
import { SettingsAppearance } from "@/features/setup/appearance/settings-appearance";
import { SettingsAssistant } from "@/features/setup/assistant/settings-assistant";
import { SettingsBackup } from "@/features/setup/backup/settings-backup";
import { SettingsCalendars } from "@/features/setup/calendars/settings-calendars";
import { SettingsData } from "@/features/setup/data/settings-data";
import { SettingsExternalAccess } from "@/features/setup/external-access/settings-external-access";
import { SettingsIntegrations } from "@/features/setup/integrations/settings-integrations";
import { SettingsLedger } from "@/features/setup/ledger/settings-ledger";
import { SettingsMarketData } from "@/features/setup/market-data/settings-market-data";
import { SettingsMembers } from "@/features/setup/members/settings-members";
import { SettingsSecurity } from "@/features/setup/security/settings-security";
import type { SettingsTopic } from "@/features/setup/model/settings-topics";

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
