import { HelpDirectory } from "@/features/help/index/help-directory";
import { HelpPath } from "@/features/help/index/help-path";
import { HelpSymptoms } from "@/features/help/index/help-symptoms";
import { HelpTerms } from "@/features/help/index/help-terms";
import { symptomsOf, termsOf } from "@/features/help/model/help-library";
import type { HelpLibrary } from "@/features/help/model/help-library";

interface HelpIndexBlocksProps {
  // Undefined while the pages load.
  library: HelpLibrary | undefined;
}

// The index under the search, in the order of the reader's questions: where to start, the task
// by area of the app, a symptom, a term (help spec, HP1).
export function HelpIndexBlocks({ library }: HelpIndexBlocksProps) {
  return (
    <>
      <HelpPath page={library?.find((p) => p.id === "first-month")} />
      <HelpDirectory library={library} />
      {library !== undefined && <HelpSymptoms symptoms={symptomsOf(library)} />}
      {library !== undefined && <HelpTerms terms={termsOf(library)} />}
    </>
  );
}
