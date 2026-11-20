import {
  Menu,
  MenuContent,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
} from "@slotted/react/menu";
import { PromptComposerAction } from "@slotted/react/prompt-composer";

import type { components } from "@/api/schema.gen";
import styles from "@/features/assistant/panel/assistant-panel.module.css";
import {
  targetKey,
  writeStoredChoice,
} from "@/features/assistant/model/chat-target";
import { useChatTarget } from "@/features/assistant/model/use-chat-target";
import { useT } from "@/i18n/i18n-provider";

const automatic = "automatic";

interface ModelMenuProps {
  chat: components["schemas"]["AssistantChat"] | undefined;
}

// Families read: menu, prompt-composer. The model of the next turns, among the targets of the
// chat's chain (model choice design, MC6).
export function ModelMenu({ chat }: ModelMenuProps) {
  const t = useT();
  const target = useChatTarget(chat);

  if (chat === undefined || chat.targets.length < 2) return null;

  const { targets } = chat;
  const label = target?.model ?? t("assistant.model.automatic");

  function handleChange(value: string) {
    const picked = targets.find((c) => targetKey(c) === value);

    writeStoredChoice(
      picked === undefined
        ? null
        : { provider_id: picked.provider_id, model: picked.model },
    );
  }

  return (
    <Menu>
      <MenuTrigger
        render={(props) => (
          <PromptComposerAction
            {...props}
            aria-label={t("assistant.model.label", { model: label })}
            className={styles.model}
          >
            {label}
          </PromptComposerAction>
        )}
      />
      <MenuContent>
        <MenuRadioGroup
          aria-label={t("assistant.model.title")}
          value={target === undefined ? automatic : targetKey(target)}
          onValueChange={handleChange}
        >
          <MenuRadioItem
            value={automatic}
            description={t("assistant.model.automaticHint")}
          >
            {t("assistant.model.automatic")}
          </MenuRadioItem>
          {targets.map((c) => (
            <MenuRadioItem
              key={targetKey(c)}
              value={targetKey(c)}
              description={c.provider_name}
            >
              {c.model}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}
