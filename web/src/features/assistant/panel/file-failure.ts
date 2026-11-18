import { ProblemError } from "@/api/problem";
import type { MessageKey } from "@/i18n/catalog.en";

// FU3: the cause of a failed file, in words, from the composer's selection rules or from the
// problem the upload returned.
export function fileFailure(cause: unknown): MessageKey {
  const code = cause instanceof ProblemError ? cause.problem.code : cause;

  switch (code) {
    case "type":
    case "file_kind_unsupported":
      return "assistant.files.failed.kind";
    case "size":
    case "file_too_large":
      return "assistant.files.failed.size";
    case "maxFiles":
      return "assistant.files.failed.count";
    case "totalSize":
    case "conversation_files_full":
      return "assistant.files.failed.full";
    default:
      return "assistant.files.failed.network";
  }
}
