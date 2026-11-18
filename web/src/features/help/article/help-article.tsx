import { Divider } from "@slotted/react/divider";
import { Markdown } from "@slotted/react/markdown";
import { TableOfContents } from "@slotted/react/table-of-contents";
import { useState } from "react";

import { HelpAfter } from "@/features/help/after/help-after";
import { HelpBlocks } from "@/features/help/article/help-blocks";
import { HelpFix } from "@/features/help/article/help-fix";
import { HelpPart } from "@/features/help/article/help-part";
import { useHashTarget } from "@/features/help/article/use-hash-target";
import { HelpOpenScreen } from "@/features/help/header/help-open-screen";
import { helpPages } from "@/features/help/model/help-pages";
import type { HelpDocument } from "@/features/help/model/parse-help-page";
import { HelpPager } from "@/features/help/pager/help-pager";
import styles from "@/features/help/styles/help.module.css";
import { useT } from "@/i18n/i18n-provider";
import { screenLinks } from "@/navigation/screen-links";
import { compactQuery, useMediaQuery } from "@/ui/runtime/use-media-query";
import { usePageWide } from "@/ui/runtime/use-page-wide";

// The id of the closing section, the same in every language.
const AFTER = "after";

interface HelpArticleProps {
  document: HelpDocument;
  page: string;
}

// The sections of the page in a column before its text from 1024 px of page, folded above it
// below; then the text, what follows the task, and the way on to the next page (help spec, HP14).
export function HelpArticle({ document, page }: HelpArticleProps) {
  const t = useT();
  const wide = usePageWide();
  const phone = useMediaQuery(compactQuery);
  const [text, setText] = useState<HTMLElement | null>(null);

  useHashTarget(text !== null);

  const task = helpPages.find((p) => p.id === page)?.kind === "howto";
  const symptoms = page === "troubleshooting";

  return (
    <div className={styles.guide} data-part="guide">
      <div className={styles.rail}>
        {text !== null && (
          <TableOfContents
            source={text}
            levels={[2, 2]}
            label={t("help.toc")}
            layout={wide ? "vertical" : "collapsed"}
            history="replace"
            size="sm"
          />
        )}
      </div>

      <article className={styles.reading} ref={setText}>
        <div className={styles.lead}>
          <Markdown
            source={document.leadMarkdown}
            size="xl"
            renderers={screenLinks}
          />
        </div>

        {phone && (
          <div className={styles.openScreen}>
            <HelpOpenScreen page={page} variant="outline" />
          </div>
        )}

        <HelpBlocks blocks={document.intro} />

        {document.sections.map((section) => (
          <HelpPart key={section.id} id={section.id} title={section.title}>
            {symptoms && section.written && <HelpFix blocks={section.blocks} />}
            {!(symptoms && section.written) && (
              <HelpBlocks blocks={section.blocks} />
            )}
          </HelpPart>
        ))}

        {task && (
          <HelpPart id={AFTER} title={t("help.after.title")}>
            <HelpAfter page={page} title={document.title} />
          </HelpPart>
        )}
        {!task && <HelpAfter page={page} title={document.title} />}

        <Divider />
        <HelpPager page={page} />
      </article>
    </div>
  );
}
