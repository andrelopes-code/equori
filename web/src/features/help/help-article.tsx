import { Divider } from "@slotted/react/divider";
import { Markdown } from "@slotted/react/markdown";
import { Stack } from "@slotted/react/stack";
import { TableOfContents } from "@slotted/react/table-of-contents";
import { useState } from "react";

import { HelpPager } from "@/features/help/help-pager";
import styles from "@/features/help/help-page.module.css";
import { useT } from "@/i18n/i18n-provider";
import { screenLinks } from "@/navigation/screen-links";
import { useMediaQuery } from "@/ui/use-media-query";

// The 13 rem column of the sections beside a reading line needs this width; below it the list
// folds above the text.
const besideQuery = "(min-width: 1280px)";

interface HelpArticleProps {
  lead: string;
  body: string;
  page: string;
}

// The text at the reading line, the list of its sections, and the way on to the next page.
export function HelpArticle({ lead, body, page }: HelpArticleProps) {
  const t = useT();
  const beside = useMediaQuery(besideQuery);
  const [text, setText] = useState<HTMLElement | null>(null);

  const sections =
    text === null ? null : (
      <TableOfContents
        source={text}
        levels={[2, 2]}
        label={t("help.toc")}
        layout={beside ? "vertical" : "collapsed"}
        sticky={beside}
        history="replace"
        size="sm"
      />
    );

  return (
    <div className={styles.article}>
      <div className={styles.text}>
        {!beside && sections}
        <Stack gap={7}>
          <div className={styles.lead}>
            <Markdown source={lead} size="lg" renderers={screenLinks} />
          </div>
          <div ref={setText}>
            <Markdown source={body} size="md" renderers={screenLinks} />
          </div>
          <Divider />
          <HelpPager page={page} />
        </Stack>
      </div>

      {beside && sections}
    </div>
  );
}
