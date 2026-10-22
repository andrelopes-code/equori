import { Shortcut } from "@slotted/react/kbd";
import {
  PromptComposer,
  PromptComposerFooter,
  PromptComposerInput,
} from "@slotted/react/prompt-composer";

import styles from "@/features/transactions/capture-composer.module.css";
import { useT } from "@/i18n/i18n-provider";

// Families read: textarea, prompt-composer. The composer draws the frame, the growing input,
// the footer and Mod+Enter; what it lacks is the halo that marks the text as read for the
// owner, a ring of the data hues that lights and turns while the composer is in use or the
// drafts are on their way (equori's identity for text the application reads, not a finding).
// The ring is the composer's focus mark, so the composer holds no other control to focus.
export function CaptureComposer({
  value,
  onChange,
  onRecord,
  busy,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  onRecord: () => void;
  // The drafts are being read or recorded.
  busy: boolean;
  autoFocus: boolean;
}) {
  const t = useT();
  return (
    <div className={styles.halo} data-busy={busy || undefined}>
      <div className={styles.glow} aria-hidden="true">
        <div className={styles.disc} />
      </div>
      <div className={styles.ring} aria-hidden="true">
        <div className={styles.disc} />
      </div>
      <PromptComposer
        value={value}
        submitOn="mod-enter"
        onValueChange={(next, request) => {
          // The text stays until the drafts are recorded; the page clears it then.
          if (request.reason === "submit") {
            request.cancel();
            return;
          }
          onChange(next);
        }}
        onValueSubmit={(_, request) => {
          request.cancel();
          onRecord();
        }}
      >
        <PromptComposerInput
          aria-label={t("capture.text")}
          placeholder={t("capture.placeholder")}
          rows={5}
          maxRows={16}
          maxLength={10000}
          spellCheck={false}
          autoComplete="off"
          autoFocus={autoFocus}
        />
        <PromptComposerFooter>
          <span className={styles.hint}>
            <svg
              className={styles.spark}
              viewBox="0 0 24 24"
              width="1em"
              height="1em"
              fill="currentColor"
              aria-hidden="true"
              focusable="false"
            >
              {/* Lucide 0.460 "sparkle" geometry (ISC licence), filled. */}
              <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
            </svg>
            {t("capture.composerHint")}
            <Shortcut keys="mod+enter" />
          </span>
        </PromptComposerFooter>
      </PromptComposer>
    </div>
  );
}
